import { BadRequestException, Injectable } from '@nestjs/common';
import { LabService } from '../lab/lab.service';
import { LabAttemptService } from '../lab/lab-attempt.service';
import { asRecord } from '../circuit-validation/circuit-rules';
import { buildStudentCircuit } from '../circuit-validation/lab-circuit.adapter';
import { calculate } from './ai-calculations';
import type { AiContext } from './ai-request';

const functionTool = (
  name: string,
  description: string,
  properties: Record<string, unknown> = {},
) => ({
  type: 'function',
  function: {
    name,
    description,
    parameters: {
      type: 'object',
      properties,
      required: 'operation' in properties ? ['operation'] : [],
      additionalProperties: false,
    },
  },
});
export const AI_TOOLS = [
  functionTool(
    'inspect_lab',
    'Read saved instructor procedures, equipment values and reference wiring. This reference is not the student circuit.',
  ),
  functionTool(
    'inspect_workspace',
    'Inspect the current student circuit and run the same read-only validation as Check Progress. Does not submit or save a grade.',
  ),
  functionTool(
    'calculate',
    'Calculate ideal Ohm law, series/parallel resistance, or compare a student reading to tolerances. Convert inputs to SI units first; never invent missing values.',
    {
      operation: {
        type: 'string',
        enum: [
          'ohms_law',
          'series_resistance',
          'parallel_resistance',
          'compare_measurement',
        ],
      },
      voltageV: { type: 'number' },
      currentA: { type: 'number' },
      resistanceOhms: { type: 'number' },
      resistancesOhms: {
        type: 'array',
        items: { type: 'number' },
        minItems: 1,
        maxItems: 50,
      },
      reading: { type: 'number' },
      minimum: { type: 'number' },
      maximum: { type: 'number' },
      unit: { type: 'string' },
    },
  ),
];
const configSummary = (value: unknown) => {
  const config = asRecord(value) ?? {};
  const allowed = [
    'name',
    'resistance',
    'voltage',
    'current',
    'capacitance',
    'inductance',
    'frequency',
    'amplitude',
    'waveform',
    'powerRating',
  ];
  return Object.fromEntries(
    allowed.flatMap((key) => {
      const item = config[key];
      return typeof item === 'number' ||
        typeof item === 'boolean' ||
        (typeof item === 'string' && item.length <= 100)
        ? [[key, item]]
        : [];
    }),
  );
};

@Injectable()
export class AiToolsService {
  constructor(
    private readonly labs: LabService,
    private readonly attempts: LabAttemptService,
  ) {}

  async prepare(context: AiContext) {
    const lab = context.labId ? await this.labs.findOne(context.labId) : null;
    const placements = lab?.labEquipments ?? [];
    if (context.workspace) {
      for (const component of context.workspace.components) {
        const placement = placements.find((item) =>
          component.labEquipmentId
            ? item.id === component.labEquipmentId
            : item.equipmentId === component.equipmentId,
        );
        if (!placement || placement.equipmentId !== component.equipmentId)
          throw new BadRequestException(
            'Workspace equipment must belong to this lab.',
          );
      }
    }
    const steps = lab?.experimentSteps ?? [];
    const stepIds = new Set(steps.map((step) => step.id));
    const completedStepIds = context.completedStepIds.filter((id) =>
      stepIds.has(id),
    );
    const guide = lab
      ? {
          id: lab.id,
          name: lab.labName,
          description: lab.description?.slice(0, 2000),
          module: lab.module.moduleName,
          tolerances: {
            minimum: lab.toleranceMin,
            maximum: lab.toleranceMax,
            unit: lab.toleranceUnit,
          },
          steps: steps.slice(0, 100).map((step) => ({
            id: step.id,
            number: step.stepNumber,
            description: step.stepDescription.slice(0, 1500),
            procedure: step.procedure?.slice(0, 2500),
            minimum: step.minTolerance,
            maximum: step.maxTolerance,
            unit: step.unit,
          })),
          equipment: placements.slice(0, 100).map((item) => ({
            id: item.id,
            equipmentId: item.equipmentId,
            label: item.componentLabel,
            name: item.equipment.equipmentName,
            type: item.equipment.equipmentType,
            config: {
              ...configSummary(item.equipment.defaultConfigJson),
              ...configSummary(item.configJson),
            },
          })),
          referenceConnections: lab.wireConnections.slice(0, 200),
          rules: lab.circuitRulesJson,
        }
      : null;
    const workspace = context.workspace;
    const circuit = workspace
      ? buildStudentCircuit(placements, workspace)
      : null;
    const workspaceSummary = workspace
      ? {
          components: workspace.components.map((item, index) => {
            const source = guide?.equipment.find((placement) =>
              item.labEquipmentId
                ? placement.id === item.labEquipmentId
                : placement.equipmentId === item.equipmentId,
            );
            return {
              ...item,
              label: circuit?.components[index].label,
              name: source?.name,
              config: source?.config,
            };
          }),
          connections: workspace.connections,
          completedSteps: completedStepIds.length,
          totalSteps: steps.length,
        }
      : null;
    let validation: unknown;
    return {
      overview: {
        lab: guide
          ? {
              name: guide.name,
              description: guide.description,
              currentStep: guide.steps[context.currentStepIndex] ?? null,
              totalSteps: steps.length,
              tolerances: guide.tolerances,
            }
          : null,
        workspaceAvailable: Boolean(workspace),
        completedSteps: completedStepIds.length,
      },
      execute: async (name: string, args: unknown): Promise<unknown> => {
        if (name === 'calculate') return calculate(args);
        if (name === 'inspect_lab')
          return (
            guide ?? {
              unavailable:
                'No lab is open. Ask which lab the student is working on.',
            }
          );
        if (name === 'inspect_workspace') {
          if (!workspace || !lab)
            return {
              unavailable:
                'Live student workspace is unavailable. Do not treat reference wiring or page text as the actual circuit.',
            };
          validation ??= await this.attempts.validate(lab.id, {
            ...workspace,
            completedStepIds,
          });
          return {
            ...workspaceSummary,
            validation,
            limitations:
              'Validation checks the circuit graph against the lab rules and the instructor circuit. It is not an electrical simulator or a verified measurement. This is an unsaved progress check.',
          };
        }
        return { error: 'Unknown tool. Use only available tools.' };
      },
    };
  }
}
