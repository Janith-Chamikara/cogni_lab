import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { StudentCircuitDto } from './dto/lab.dto';
import type { LabActor } from './lab.service';
import {
  buildReferenceCircuit,
  buildRequiredComponents,
  buildStudentCircuit,
  DEFAULT_CIRCUIT_RULES,
  readStoredCircuitRules,
  validateCircuit,
  type StudentCircuitInput,
  type ValidationResult,
} from '../circuit-validation';

type AttemptSummary = {
  id: string;
  score: number;
  passed: boolean;
  submittedAt: Date;
};

/**
 * Best attempt: a validated (passed) one first, then the most checks
 * passed (internal score), then the earliest submission.
 */
export const pickBestAttempt = <T extends AttemptSummary>(attempts: T[]) =>
  attempts.reduce<T | null>((best, attempt) => {
    if (!best) return attempt;
    if (attempt.passed !== best.passed) return attempt.passed ? attempt : best;
    if (attempt.score !== best.score)
      return attempt.score > best.score ? attempt : best;
    return attempt.submittedAt < best.submittedAt ? attempt : best;
  }, null);

const asString = (value: unknown) =>
  typeof value === 'string' ? value : undefined;
const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];
const asObject = (value: unknown) =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

/**
 * Debug details (graph, tree, fingerprints) reveal the instructor's circuit,
 * so they are only returned to instructors and admins, or to everyone when
 * CIRCUIT_DEBUG=true is set for local development.
 */
export const canDebugCircuits = (actor?: LabActor | null) =>
  process.env.CIRCUIT_DEBUG === 'true' ||
  !!actor?.isInstructor ||
  !!actor?.isAdmin;

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
        wireConnections: {
          select: {
            sourceEquipmentId: true,
            targetEquipmentId: true,
            sourceHandle: true,
            targetHandle: true,
          },
        },
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
    debug = false,
  ): ValidationResult {
    // Experiment steps are instructions only. Students no longer tick them
    // off, so they are not graded; the circuit itself is.

    // Every lab is validated against circuit rules; labs without saved rules
    // use the defaults (and the instructor's wired circuit, if any).
    const rules =
      readStoredCircuitRules(lab.circuitRulesJson) ?? DEFAULT_CIRCUIT_RULES;
    const reference = buildReferenceCircuit(
      lab.labEquipments,
      lab.wireConnections,
    );

    return validateCircuit({
      required: buildRequiredComponents(lab.labEquipments),
      circuit: buildStudentCircuit(lab.labEquipments, circuit),
      rules,
      reference,
      debug,
    });
  }

  /**
   * Check the circuit without saving (the student's "Check Progress").
   * `debug: true` in the body adds graph details for permitted actors.
   */
  async validate(labId: string, body: StudentCircuitDto, actor?: LabActor) {
    const lab = await this.loadLab(labId);
    const { circuit } = this.sanitize(body);
    const debug = asObject(body).debug === true && canDebugCircuits(actor);
    return this.evaluate(lab, circuit, debug);
  }

  /** Validate and store a submission. Every submit creates a new attempt. */
  async submit(labId: string, userId: string, body: StudentCircuitDto) {
    const lab = await this.loadLab(labId);
    const { circuit, completedStepIds, actionLog } = this.sanitize(body);
    const result = this.evaluate(lab, circuit);

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
    const rows = await this.prisma.labAttempt.findMany({
      where: { labId, userId },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        score: true,
        passed: true,
        validationMode: true,
        validationResultJson: true,
        circuitStateJson: true,
        submittedAt: true,
      },
    });

    // Only the latest submission's circuit is returned, so the editor can
    // show what the student submitted when they come back.
    const attempts = rows.map((row) => {
      const attempt: Partial<typeof row> = { ...row };
      delete attempt.circuitStateJson;
      return attempt as Omit<typeof row, 'circuitStateJson'>;
    });
    const latest = rows[0];
    return {
      attempts,
      bestAttempt: pickBestAttempt(attempts),
      latestSubmission: latest
        ? {
            attemptId: latest.id,
            submittedAt: latest.submittedAt,
            passed: latest.passed,
            circuit: latest.circuitStateJson,
          }
        : null,
    };
  }
}
