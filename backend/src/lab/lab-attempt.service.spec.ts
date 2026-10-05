import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { LabAttemptService, pickBestAttempt } from './lab-attempt.service';
import { LabService, deriveLabStatus } from './lab.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { StudentCircuitDto } from './dto/lab.dto';

const resistorEquipment = {
  equipmentName: 'Resistor',
  equipmentType: 'Component',
  defaultConfigJson: { resistance: 1000 },
};

const makeLab = (circuitRulesJson: unknown) => ({
  id: 'lab-1',
  instructorId: 'instructor-1',
  circuitRulesJson,
  labEquipments: [100, 200, 300].map((resistance, i) => ({
    id: `p${i + 1}`,
    equipmentId: 'eq-res',
    configJson: { name: `R${i + 1}`, resistance },
    equipment: resistorEquipment,
  })),
  experimentSteps: [],
  _count: { wireConnections: 2 },
});

const component = (n: number) => ({
  id: `s${n}`,
  equipmentId: 'eq-res',
  labEquipmentId: `p${n}`,
});

const parallelCircuit = {
  components: [component(3), component(1), component(2)],
  connections: [
    {
      sourceEquipmentId: 's1',
      sourceHandle: 'left',
      targetEquipmentId: 's2',
      targetHandle: 'left',
    },
    {
      sourceEquipmentId: 's2',
      sourceHandle: 'left',
      targetEquipmentId: 's3',
      targetHandle: 'left',
    },
    {
      sourceEquipmentId: 's1',
      sourceHandle: 'right',
      targetEquipmentId: 's2',
      targetHandle: 'right',
    },
    {
      sourceEquipmentId: 's2',
      sourceHandle: 'right',
      targetEquipmentId: 's3',
      targetHandle: 'right',
    },
  ],
};

const makePrisma = (lab: unknown) => {
  const mocks = {
    findUniqueLab: jest.fn().mockResolvedValue(lab),
    updateLab: jest.fn().mockResolvedValue(lab),
    createAttempt: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
      id: 'a1',
      ...data,
    })),
    findAttempts: jest.fn().mockResolvedValue([]),
  };
  const prisma = {
    labInstance: { findUnique: mocks.findUniqueLab, update: mocks.updateLab },
    labAttempt: { create: mocks.createAttempt, findMany: mocks.findAttempts },
  } as unknown as PrismaService;
  return { prisma, mocks };
};

describe('LabAttemptService', () => {
  it('Test 8: an existing lab without rules keeps legacy grading', async () => {
    const service = new LabAttemptService(makePrisma(makeLab(null)).prisma);

    const result = await service.validate(
      'lab-1',
      parallelCircuit as unknown as StudentCircuitDto,
    );

    expect(result.mode).toBe('legacy');
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it('uses rule-based grading once the instructor sets rules', async () => {
    const lab = makeLab({ allowedTopologies: ['series', 'parallel'] });
    const service = new LabAttemptService(makePrisma(lab).prisma);

    const result = await service.validate(
      'lab-1',
      parallelCircuit as unknown as StudentCircuitDto,
    );

    expect(result.mode).toBe('rules');
    expect(result.passed).toBe(true);
    expect(result.checks.topology?.detected).toBe('parallel');
  });

  it('stores each submission with its circuit state and result', async () => {
    const { prisma, mocks } = makePrisma(
      makeLab({ allowedTopologies: ['series'] }),
    );
    const service = new LabAttemptService(prisma);

    const { attempt, result } = await service.submit('lab-1', 'student-1', {
      ...parallelCircuit,
      actionLog: [{ action: 'CONNECT', from: 's1.left', to: 's2.left' }],
    } as unknown as StudentCircuitDto);

    expect(result.passed).toBe(false);
    expect(mocks.createAttempt).toHaveBeenCalledTimes(1);
    expect(attempt).toMatchObject({
      labId: 'lab-1',
      userId: 'student-1',
      validationMode: 'rules',
      score: result.score,
      passed: false,
    });
  });

  it('rejects malformed circuit payloads', async () => {
    const service = new LabAttemptService(makePrisma(makeLab(null)).prisma);

    await expect(
      service.validate('lab-1', {
        components: [{ id: 'x' }],
        connections: [],
      } as unknown as StudentCircuitDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('LabAttemptService.findMySummary', () => {
  it('summarises each lab by its best attempt', async () => {
    const { prisma, mocks } = makePrisma(null);
    mocks.findAttempts.mockResolvedValue([
      {
        id: '1',
        labId: 'lab-a',
        score: 61,
        passed: false,
        submittedAt: new Date('2026-10-01'),
      },
      {
        id: '2',
        labId: 'lab-a',
        score: 100,
        passed: true,
        submittedAt: new Date('2026-10-02'),
      },
      {
        id: '3',
        labId: 'lab-b',
        score: 40,
        passed: false,
        submittedAt: new Date('2026-10-02'),
      },
    ]);

    const summary = await new LabAttemptService(prisma).findMySummary(
      'student-1',
    );

    expect(summary).toEqual([
      { labId: 'lab-a', attemptCount: 2, bestScore: 100, passed: true },
      { labId: 'lab-b', attemptCount: 1, bestScore: 40, passed: false },
    ]);
  });
});

describe('pickBestAttempt', () => {
  it('chooses the highest score, then a passing attempt, then the earliest', () => {
    const attempts = [
      {
        id: 'late',
        score: 90,
        passed: true,
        submittedAt: new Date('2026-10-03'),
      },
      {
        id: 'low',
        score: 60,
        passed: false,
        submittedAt: new Date('2026-10-01'),
      },
      {
        id: 'early',
        score: 90,
        passed: true,
        submittedAt: new Date('2026-10-02'),
      },
    ];

    expect(pickBestAttempt(attempts)?.id).toBe('early');
    expect(pickBestAttempt([])).toBeNull();
  });
});

describe('deriveLabStatus', () => {
  it('derives the status from student submissions', () => {
    expect(deriveLabStatus(0, 0)).toBe('NOT_STARTED');
    expect(deriveLabStatus(3, 0)).toBe('IN_PROGRESS');
    expect(deriveLabStatus(3, 1)).toBe('COMPLETED');
  });
});

describe('LabService.findByInstructor', () => {
  it('replaces the stored status with one derived from submissions', async () => {
    const lab = (id: string) => ({ id, completionStatus: 'NOT_STARTED' });
    const prisma = {
      labInstance: {
        findMany: jest.fn().mockResolvedValue([lab('a'), lab('b'), lab('c')]),
      },
      labAttempt: {
        groupBy: jest.fn().mockResolvedValue([
          { labId: 'a', passed: false, _count: { _all: 2 } },
          { labId: 'b', passed: false, _count: { _all: 1 } },
          { labId: 'b', passed: true, _count: { _all: 1 } },
        ]),
      },
    };
    const service = new LabService(prisma as unknown as PrismaService);

    const labs = await service.findByInstructor('instructor-1');

    expect(labs.map((l) => [l.id, l.completionStatus])).toEqual([
      ['a', 'IN_PROGRESS'],
      ['b', 'COMPLETED'],
      ['c', 'NOT_STARTED'],
    ]);
    expect(prisma.labAttempt.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { lab: { instructorId: 'instructor-1' } },
      }),
    );
  });
});

describe('LabService.updateRules', () => {
  const rules = { allowedTopologies: ['parallel'] };

  it('lets the owning instructor set rules', async () => {
    const { prisma, mocks } = makePrisma(makeLab(null));
    const service = new LabService(prisma);

    await service.updateRules(
      'lab-1',
      { userId: 'instructor-1', isInstructor: true, isAdmin: false },
      rules,
    );

    expect(mocks.updateLab).toHaveBeenCalledWith({
      where: { id: 'lab-1' },
      data: {
        circuitRulesJson: expect.objectContaining({
          allowedTopologies: ['parallel'],
        }) as unknown,
      },
    });
  });

  it('forbids students and instructors who do not own the lab', async () => {
    const service = new LabService(makePrisma(makeLab(null)).prisma);

    await expect(
      service.updateRules(
        'lab-1',
        { userId: 'instructor-1', isInstructor: false, isAdmin: false },
        rules,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.updateRules(
        'lab-1',
        { userId: 'other', isInstructor: true, isAdmin: false },
        rules,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid rules', async () => {
    const service = new LabService(makePrisma(makeLab(null)).prisma);

    await expect(
      service.updateRules(
        'lab-1',
        { userId: 'instructor-1', isInstructor: true, isAdmin: false },
        { allowedTopologies: ['star'] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('LabService.delete', () => {
  const withDelete = () => {
    const { prisma, mocks } = makePrisma(makeLab(null));
    const deleteLab = jest.fn().mockResolvedValue({ id: 'lab-1' });
    (prisma.labInstance as unknown as { delete: jest.Mock }).delete = deleteLab;
    return { service: new LabService(prisma), deleteLab, mocks };
  };

  it('lets the owning instructor or an admin delete the lab', async () => {
    const { service, deleteLab } = withDelete();

    await service.delete('lab-1', {
      userId: 'instructor-1',
      isInstructor: true,
      isAdmin: false,
    });
    await service.delete('lab-1', {
      userId: 'admin-1',
      isInstructor: true,
      isAdmin: true,
    });

    expect(deleteLab).toHaveBeenCalledTimes(2);
    expect(deleteLab).toHaveBeenCalledWith({ where: { id: 'lab-1' } });
  });

  it('forbids students and instructors who do not own the lab', async () => {
    const { service, deleteLab } = withDelete();

    await expect(
      service.delete('lab-1', {
        userId: 'instructor-1',
        isInstructor: false,
        isAdmin: false,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.delete('lab-1', {
        userId: 'other',
        isInstructor: true,
        isAdmin: false,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(deleteLab).not.toHaveBeenCalled();
  });
});
