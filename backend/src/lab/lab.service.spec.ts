import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { LabService, type LabActor } from './lab.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { CreateLabDto } from './dto/lab.dto';

const student: LabActor = { userId: 's1', isInstructor: false, isAdmin: false };
const owner: LabActor = { userId: 'i1', isInstructor: true, isAdmin: false };
const otherInstructor: LabActor = {
  userId: 'i2',
  isInstructor: true,
  isAdmin: false,
};
const admin: LabActor = { userId: 'a1', isInstructor: true, isAdmin: true };

const makePrisma = () => ({
  labInstance: {
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'lab-1' }),
    update: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
      id: 'lab-1',
      ...data,
    })),
  },
});

const labWith = (parts: number, steps: number) => ({
  id: 'lab-1',
  instructorId: 'i1',
  _count: { labEquipments: parts, experimentSteps: steps },
});

describe('LabService publishing', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: LabService;

  /** The data passed to labInstance.create. */
  const createdData = () =>
    (prisma.labInstance.create.mock.calls[0] as [{ data: unknown }])[0].data;

  beforeEach(() => {
    prisma = makePrisma();
    service = new LabService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    const dto = { moduleId: 'm1', labName: 'Lab' } as CreateLabDto;

    beforeEach(() => {
      // create() returns findOne(); only the stored data matters here.
      jest.spyOn(service, 'findOne').mockResolvedValue({} as never);
    });

    it('starts new labs as drafts', async () => {
      await service.create('i1', dto);

      expect(createdData()).toMatchObject({
        publishStatus: 'DRAFT',
      });
    });

    it('ignores an unknown status', async () => {
      await service.create('i1', {
        ...dto,
        publishStatus: 'ACTIVE',
      } as unknown as CreateLabDto);

      expect(createdData()).toMatchObject({
        publishStatus: 'DRAFT',
      });
    });

    it('refuses to create an empty lab as published', async () => {
      await expect(
        service.create('i1', {
          ...dto,
          publishStatus: 'PUBLISHED',
        } as CreateLabDto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.labInstance.create).not.toHaveBeenCalled();
    });
  });

  it('findAll only lists published labs', async () => {
    await service.findAll();

    expect(prisma.labInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { publishStatus: 'PUBLISHED' } }),
    );
  });

  describe('assertVisibleTo', () => {
    it.each([
      ['DRAFT', student, false],
      ['ARCHIVED', student, false],
      ['PUBLISHED', student, true],
      ['DRAFT', otherInstructor, true],
      ['ARCHIVED', admin, true],
    ] as const)('%s lab, %o -> visible %p', async (status, actor, visible) => {
      prisma.labInstance.findUnique.mockResolvedValue({
        publishStatus: status,
      });

      const check = service.assertVisibleTo('lab-1', actor);
      if (visible) await expect(check).resolves.toBeUndefined();
      else await expect(check).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws for a lab that does not exist', async () => {
      prisma.labInstance.findUnique.mockResolvedValue(null);

      await expect(
        service.assertVisibleTo('nope', owner),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updatePublishStatus', () => {
    it('lets the owner publish a lab with parts', async () => {
      prisma.labInstance.findUnique.mockResolvedValue(labWith(2, 0));

      await expect(
        service.updatePublishStatus('lab-1', owner, 'PUBLISHED'),
      ).resolves.toEqual({ id: 'lab-1', publishStatus: 'PUBLISHED' });
    });

    it('allows a lab with only steps', async () => {
      prisma.labInstance.findUnique.mockResolvedValue(labWith(0, 3));

      await expect(
        service.updatePublishStatus('lab-1', owner, 'PUBLISHED'),
      ).resolves.toMatchObject({ publishStatus: 'PUBLISHED' });
    });

    it('refuses to publish an empty lab', async () => {
      prisma.labInstance.findUnique.mockResolvedValue(labWith(0, 0));

      await expect(
        service.updatePublishStatus('lab-1', owner, 'PUBLISHED'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.labInstance.update).not.toHaveBeenCalled();
    });

    it('lets an empty lab go back to draft or be archived', async () => {
      prisma.labInstance.findUnique.mockResolvedValue(labWith(0, 0));

      await expect(
        service.updatePublishStatus('lab-1', owner, 'ARCHIVED'),
      ).resolves.toMatchObject({ publishStatus: 'ARCHIVED' });
    });

    it('lets an admin change any lab', async () => {
      prisma.labInstance.findUnique.mockResolvedValue(labWith(1, 0));

      await expect(
        service.updatePublishStatus('lab-1', admin, 'DRAFT'),
      ).resolves.toMatchObject({ publishStatus: 'DRAFT' });
    });

    it.each([student, otherInstructor])(
      "forbids %o from changing someone else's lab",
      async (actor) => {
        prisma.labInstance.findUnique.mockResolvedValue(labWith(1, 1));

        await expect(
          service.updatePublishStatus('lab-1', actor, 'PUBLISHED'),
        ).rejects.toBeInstanceOf(ForbiddenException);
      },
    );

    it('rejects an unknown status', async () => {
      await expect(
        service.updatePublishStatus('lab-1', owner, 'ACTIVE'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.labInstance.findUnique).not.toHaveBeenCalled();
    });

    it('throws for a lab that does not exist', async () => {
      prisma.labInstance.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePublishStatus('nope', owner, 'DRAFT'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
