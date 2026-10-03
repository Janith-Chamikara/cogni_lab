import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { StudentCircuitDto } from './dto/lab.dto';
import {
  buildRequiredComponents,
  buildStudentCircuit,
  readStoredCircuitRules,
  validateCircuit,
  validateLegacyCircuit,
  type StudentCircuitInput,
  type ValidationResult,
} from '../circuit-validation';

type AttemptSummary = {
  id: string;
  score: number;
  passed: boolean;
  submittedAt: Date;
};

/** Best attempt: highest score, then passed, then the earliest submission. */
export const pickBestAttempt = <T extends AttemptSummary>(attempts: T[]) =>
  attempts.reduce<T | null>((best, attempt) => {
    if (!best) return attempt;
    if (attempt.score !== best.score)
      return attempt.score > best.score ? attempt : best;
    if (attempt.passed !== best.passed) return attempt.passed ? attempt : best;
    return attempt.submittedAt < best.submittedAt ? attempt : best;
  }, null);

const asString = (value: unknown) =>
  typeof value === 'string' ? value : undefined;
const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];
const asObject = (value: unknown) =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

@Injectable()
export class LabAttemptService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Normalise the request body. Nest has no global ValidationPipe in this
   * project, so the shape is enforced here.
   */
  private sanitize(body: StudentCircuitDto) {
    const raw = asObject(body);
    const components = asArray(raw.components).map(asObject);
    const connections = asArray(raw.connections).map(asObject);

    if (components.some((c) => !asString(c.id) || !asString(c.equipmentId))) {
      throw new BadRequestException(
        'Each component needs an id and equipmentId',
      );
    }
    if (
      connections.some(
        (c) => !asString(c.sourceEquipmentId) || !asString(c.targetEquipmentId),
      )
    ) {
      throw new BadRequestException(
        'Each connection needs a sourceEquipmentId and targetEquipmentId',
      );
    }

    return {
      circuit: {
        components: components.map((c) => ({
          id: c.id as string,
          equipmentId: c.equipmentId as string,
          labEquipmentId: asString(c.labEquipmentId) ?? null,
          positionX: typeof c.positionX === 'number' ? c.positionX : 0,
          positionY: typeof c.positionY === 'number' ? c.positionY : 0,
        })),
        connections: connections.map((c) => ({
          sourceEquipmentId: c.sourceEquipmentId as string,
          targetEquipmentId: c.targetEquipmentId as string,
          sourceHandle: asString(c.sourceHandle) ?? null,
          targetHandle: asString(c.targetHandle) ?? null,
          wireColor: asString(c.wireColor) ?? null,
        })),
      },
      completedStepIds: asArray(raw.completedStepIds).filter(
        (id): id is string => typeof id === 'string',
      ),
      actionLog: asArray(raw.actionLog).map(asObject),
    };
  }

  private async loadLab(labId: string) {
    const lab = await this.prisma.labInstance.findUnique({
      where: { id: labId },
      include: {
        labEquipments: { include: { equipment: true } },
        experimentSteps: { select: { id: true } },
        _count: { select: { wireConnections: true } },
      },
    });

    if (!lab) {
      throw new NotFoundException(`Lab with ID ${labId} not found`);
    }

    return lab;
  }

  private evaluate(
    lab: Awaited<ReturnType<LabAttemptService['loadLab']>>,
    circuit: StudentCircuitInput,
    completedStepIds: string[],
  ): ValidationResult {
    const stepIds = new Set(lab.experimentSteps.map((s) => s.id));
    const steps = {
      total: stepIds.size,
      completed: new Set(completedStepIds.filter((id) => stepIds.has(id))).size,
    };

    const rules = readStoredCircuitRules(lab.circuitRulesJson);

    if (!rules) {
      return validateLegacyCircuit({
        expectedEquipmentIds: lab.labEquipments.map((p) => p.equipmentId),
        equipmentNames: Object.fromEntries(
          lab.labEquipments.map((p) => [
            p.equipmentId,
            p.equipment.equipmentName,
          ]),
        ),
        expectedConnectionCount: lab._count.wireConnections,
        placedEquipmentIds: circuit.components.map((c) => c.equipmentId),
        connectionCount: circuit.connections.length,
        steps,
      });
    }

    return validateCircuit({
      required: buildRequiredComponents(lab.labEquipments),
      circuit: buildStudentCircuit(lab.labEquipments, circuit),
      rules,
      steps,
    });
  }

  /** Check the circuit without saving (the student's "Check Progress"). */
  async validate(labId: string, body: StudentCircuitDto) {
    const lab = await this.loadLab(labId);
    const { circuit, completedStepIds } = this.sanitize(body);
    return this.evaluate(lab, circuit, completedStepIds);
  }

  /** Validate and store a submission. Every submit creates a new attempt. */
  async submit(labId: string, userId: string, body: StudentCircuitDto) {
    const lab = await this.loadLab(labId);
    const { circuit, completedStepIds, actionLog } = this.sanitize(body);
    const result = this.evaluate(lab, circuit, completedStepIds);

    const attempt = await this.prisma.labAttempt.create({
      data: {
        labId,
        userId,
        circuitStateJson: {
          ...circuit,
          completedStepIds,
        } as Prisma.InputJsonValue,
        actionLogJson:
          actionLog.length > 0
            ? (actionLog as Prisma.InputJsonValue)
            : undefined,
        validationResultJson: result as unknown as Prisma.InputJsonValue,
        validationMode: result.mode,
        score: result.score,
        passed: result.passed,
      },
    });

    const { bestAttempt } = await this.findMine(labId, userId);
    return { attempt, result, bestAttempt };
  }

  /**
   * One row per lab the student has submitted, based on their best attempt.
   * Used for the student dashboard's Completed / In Progress counts.
   */
  async findMySummary(userId: string) {
    const attempts = await this.prisma.labAttempt.findMany({
      where: { userId },
      select: {
        id: true,
        labId: true,
        score: true,
        passed: true,
        submittedAt: true,
      },
    });

    const byLab = new Map<string, typeof attempts>();
    for (const attempt of attempts) {
      byLab.set(attempt.labId, [...(byLab.get(attempt.labId) ?? []), attempt]);
    }

    return [...byLab.entries()].map(([labId, labAttempts]) => {
      const best = pickBestAttempt(labAttempts)!;
      return {
        labId,
        attemptCount: labAttempts.length,
        bestScore: best.score,
        passed: best.passed,
      };
    });
  }

  /** The student's own attempts for a lab, newest first, plus the best one. */
  async findMine(labId: string, userId: string) {
    const attempts = await this.prisma.labAttempt.findMany({
      where: { labId, userId },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        score: true,
        passed: true,
        validationMode: true,
        validationResultJson: true,
        submittedAt: true,
      },
    });

    return { attempts, bestAttempt: pickBestAttempt(attempts) };
  }
}
