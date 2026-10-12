import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { SaveLabDraftDto } from './dto/lab.dto';
import { sanitizeStudentCircuit } from './lab-attempt.service';

/** Keep a saved step index inside the lab's steps. */
const clampStepIndex = (value: unknown, stepCount: number) => {
  const index = Math.trunc(Number(value));
  if (!Number.isFinite(index) || index < 0) return 0;
  return Math.min(index, Math.max(stepCount - 1, 0));
};

@Injectable()
export class LabDraftService {
  constructor(private readonly prisma: PrismaService) {}

  /** Save the student's draft, replacing any earlier one for this lab. */
  async save(labId: string, userId: string, body: SaveLabDraftDto) {
    const lab = await this.prisma.labInstance.findUnique({
      where: { id: labId },
      select: { id: true, _count: { select: { experimentSteps: true } } },
    });

    if (!lab) {
      throw new NotFoundException(`Lab with ID ${labId} not found`);
    }

    const { circuit } = sanitizeStudentCircuit(body);
    const circuitStateJson = circuit as Prisma.InputJsonValue;
    const currentStepIndex = clampStepIndex(
      (body as Partial<SaveLabDraftDto> | undefined)?.currentStepIndex,
      lab._count.experimentSteps,
    );

    return this.prisma.labDraft.upsert({
      where: { labId_userId: { labId, userId } },
      create: { labId, userId, circuitStateJson, currentStepIndex },
      update: { circuitStateJson, currentStepIndex },
      select: { labId: true, currentStepIndex: true, updatedAt: true },
    });
  }

  /** The student's draft for a lab, or null. */
  async findMine(labId: string, userId: string) {
    const draft = await this.prisma.labDraft.findUnique({
      where: { labId_userId: { labId, userId } },
      select: {
        labId: true,
        circuitStateJson: true,
        currentStepIndex: true,
        updatedAt: true,
      },
    });

    if (!draft) return null;

    const { circuitStateJson, ...rest } = draft;
    return { ...rest, circuit: circuitStateJson };
  }

  /** Deleting a draft that does not exist is a no-op. */
  async deleteMine(labId: string, userId: string) {
    const { count } = await this.prisma.labDraft.deleteMany({
      where: { labId, userId },
    });
    return { deleted: count > 0 };
  }

  /** Which labs the student has a draft for (student dashboard). */
  async findMySummary(userId: string) {
    return this.prisma.labDraft.findMany({
      where: { userId },
      select: { labId: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
