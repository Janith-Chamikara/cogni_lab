import { NotFoundException } from '@nestjs/common';
import { LabDraftService } from './lab-draft.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { SaveLabDraftDto } from './dto/lab.dto';

const savedAt = new Date('2026-10-12T10:00:00Z');

const makePrisma = (stepCount: number | null) => ({
  labInstance: {
    findUnique: jest
      .fn()
      .mockResolvedValue(
        stepCount === null
          ? null
          : { id: 'lab-1', _count: { experimentSteps: stepCount } },
      ),
  },
  labDraft: {
    upsert: jest.fn(
      ({
        create,
      }: {
        where: unknown;
        create: Record<string, unknown>;
        update: unknown;
      }) => ({
        labId: create.labId,
        currentStepIndex: create.currentStepIndex,
        updatedAt: savedAt,
      }),
    ),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
});

const draftBody = (currentStepIndex?: unknown) =>
  ({
    components: [
      {
        id: 's1',
        equipmentId: 'eq-res',
        labEquipmentId: 'p1',
        positionX: 10,
        positionY: 20,
        configJson: { ignored: true },
      },
    ],
    connections: [],
    currentStepIndex,
  }) as unknown as SaveLabDraftDto;

describe('LabDraftService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: LabDraftService;

  const useLab = (stepCount: number | null) => {
    prisma = makePrisma(stepCount);
    service = new LabDraftService(prisma as unknown as PrismaService);
  };

  beforeEach(() => useLab(3));

  describe('save', () => {
    it('upserts one draft per student and lab with the cleaned circuit', async () => {
      const result = await service.save('lab-1', 'student-1', draftBody(1));

      const call = prisma.labDraft.upsert.mock.calls[0][0];
      expect(call.where).toEqual({
        labId_userId: { labId: 'lab-1', userId: 'student-1' },
      });
      expect(call.create.circuitStateJson).toEqual({
        components: [
          {
            id: 's1',
            equipmentId: 'eq-res',
            labEquipmentId: 'p1',
            positionX: 10,
            positionY: 20,
          },
        ],
        connections: [],
      });
      expect(call.update).toEqual({
        circuitStateJson: call.create.circuitStateJson,
        currentStepIndex: 1,
      });
      expect(result).toEqual({
        labId: 'lab-1',
        currentStepIndex: 1,
        updatedAt: savedAt,
      });
    });

    it.each([
      [99, 2],
      [-4, 0],
      ['abc', 0],
      [undefined, 0],
      [1.7, 1],
    ])('clamps step index %p to %p', async (input, expected) => {
      await service.save('lab-1', 'student-1', draftBody(input));

      expect(
        prisma.labDraft.upsert.mock.calls[0][0].create.currentStepIndex,
      ).toBe(expected);
    });

    it('uses step 0 for a lab without steps', async () => {
      useLab(0);
      await service.save('lab-1', 'student-1', draftBody(5));

      expect(
        prisma.labDraft.upsert.mock.calls[0][0].create.currentStepIndex,
      ).toBe(0);
    });

    it('throws for an unknown lab', async () => {
      useLab(null);

      await expect(
        service.save('nope', 'student-1', draftBody(0)),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.labDraft.upsert).not.toHaveBeenCalled();
    });
  });

  it('findMine returns the circuit, or null when there is no draft', async () => {
    prisma.labDraft.findUnique.mockResolvedValueOnce({
      labId: 'lab-1',
      circuitStateJson: { components: [], connections: [] },
      currentStepIndex: 2,
      updatedAt: savedAt,
    });

    await expect(service.findMine('lab-1', 'student-1')).resolves.toEqual({
      labId: 'lab-1',
      circuit: { components: [], connections: [] },
      currentStepIndex: 2,
      updatedAt: savedAt,
    });

    prisma.labDraft.findUnique.mockResolvedValueOnce(null);
    await expect(service.findMine('lab-1', 'student-1')).resolves.toBeNull();
  });

  it('deleteMine only touches the caller draft and is a no-op without one', async () => {
    prisma.labDraft.deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.deleteMine('lab-1', 'student-1')).resolves.toEqual({
      deleted: false,
    });
    expect(prisma.labDraft.deleteMany).toHaveBeenCalledWith({
      where: { labId: 'lab-1', userId: 'student-1' },
    });
  });

  it('findMySummary lists the student drafts', async () => {
    prisma.labDraft.findMany.mockResolvedValue([
      { labId: 'lab-1', updatedAt: savedAt },
    ]);

    await expect(service.findMySummary('student-1')).resolves.toEqual([
      { labId: 'lab-1', updatedAt: savedAt },
    ]);
    expect(prisma.labDraft.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'student-1' } }),
    );
  });
});
