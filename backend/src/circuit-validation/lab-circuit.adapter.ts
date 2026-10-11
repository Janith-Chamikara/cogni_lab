import {
  resolveComponentParams,
  resolveComponentValue,
  resolveEquipmentDefinition,
  type EquipmentLike,
} from './component-registry';
import { compileDefinition } from './component-definition';
import { asRecord } from './circuit-rules';
import type {
  CircuitComponent,
  CircuitState,
  ComponentDefinition,
  TerminalSpec,
} from './types';

// Converts the project's existing data shapes (LabInstanceEquipment
// placements, WireConnection-style wires) into validation engine inputs.

export interface LabPlacementLike {
  id: string;
  equipmentId: string;
  configJson?: unknown;
  equipment?: EquipmentLike | null;
}

/** A wire saved by the instructor (WireConnection rows). */
export interface LabWireLike {
  sourceEquipmentId: string;
  targetEquipmentId: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

/** Student circuit as sent by the student editor. */
export interface StudentCircuitInput {
  components: Array<{
    id: string;
    equipmentId: string;
    /** The instructor placement this component was taken from. */
    labEquipmentId?: string | null;
  }>;
  connections: Array<{
    sourceEquipmentId: string;
    targetEquipmentId: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }>;
}

const NO_EQUIPMENT: EquipmentLike = { equipmentName: '', equipmentType: '' };

const describePlacement = (placement: LabPlacementLike) => {
  const config = asRecord(placement.configJson);
  const defaults = asRecord(placement.equipment?.defaultConfigJson);
  const spec = compileDefinition(
    resolveEquipmentDefinition(
      placement.equipment ?? NO_EQUIPMENT,
      config ?? defaults,
    ),
  );
  return {
    spec,
    value: resolveComponentValue(spec, config, defaults),
    params: resolveComponentParams(spec, config, defaults),
    name:
      typeof config?.name === 'string' && config.name.trim()
        ? config.name.trim()
        : null,
  };
};

/**
 * Required components of a lab, one per instructor placement. Labels come
 * from the placement's configured name, otherwise R1, R2, C1, V1, ...
 */
export const buildRequiredComponents = (
  placements: LabPlacementLike[],
): CircuitComponent[] => {
  const counters = new Map<string, number>();
  return placements.map((placement) => {
    const { spec, value, name, params } = describePlacement(placement);
    const prefix = spec.labelPrefix;
    const count = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, count);
    return {
      id: placement.id,
      label: name ?? `${prefix}${count}`,
      kind: spec.kind,
      value,
      spec,
      ...(params && { params }),
    };
  });
};

/**
 * How a library or placed equipment behaves, for the editors: its definition
 * (own or preset) and the terminals the canvas draws as handles.
 */
export const describeEquipmentComponent = (
  equipment: EquipmentLike,
  configJson?: unknown,
): { component: ComponentDefinition; terminals: TerminalSpec[] } => {
  const component = resolveEquipmentDefinition(
    equipment,
    asRecord(configJson) ?? asRecord(equipment.defaultConfigJson),
  );
  return { component, terminals: component.terminals };
};

const toWires = (connections: LabWireLike[]): CircuitState['wires'] =>
  connections.map((conn) => ({
    from: {
      componentId: conn.sourceEquipmentId,
      handle: conn.sourceHandle ?? 'right',
    },
    to: {
      componentId: conn.targetEquipmentId,
      handle: conn.targetHandle ?? 'left',
    },
  }));

/** The instructor's own circuit: the placements and the wires they drew. */
export const buildReferenceCircuit = (
  placements: LabPlacementLike[],
  wires: LabWireLike[],
): CircuitState => ({
  components: buildRequiredComponents(placements),
  wires: toWires(wires),
});

/**
 * Build the student's circuit. Kind, value and label are taken from the lab's
 * placements on the server, so students cannot alter component values.
 */
export const buildStudentCircuit = (
  placements: LabPlacementLike[],
  student: StudentCircuitInput,
): CircuitState => {
  const required = buildRequiredComponents(placements);
  const requiredById = new Map(required.map((r) => [r.id, r]));
  const usedLabels = new Map<string, number>();

  const components: CircuitComponent[] = student.components.map((c) => {
    const placement =
      placements.find((p) => p.id === c.labEquipmentId) ??
      placements.find((p) => p.equipmentId === c.equipmentId);
    const source = placement ? requiredById.get(placement.id) : undefined;

    const baseLabel = source?.label ?? 'Unknown component';
    const seen = (usedLabels.get(baseLabel) ?? 0) + 1;
    usedLabels.set(baseLabel, seen);

    return {
      id: c.id,
      label: seen > 1 ? `${baseLabel} (${seen})` : baseLabel,
      kind: source?.kind ?? 'unknown',
      value: source?.value ?? null,
      refId: source?.id ?? null,
      ...(source?.spec && { spec: source.spec }),
      ...(source?.params && { params: source.params }),
    };
  });

  return { components, wires: toWires(student.connections) };
};
