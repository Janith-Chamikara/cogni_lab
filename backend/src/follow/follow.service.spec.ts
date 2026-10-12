import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FollowService } from './follow.service';
import type { PrismaService } from '../prisma/prisma.service';

const instructorRow = (id: string, followers = 0, labs = 0) => ({
  id,
  fullName: `Instructor ${id}`,
  email: `${id}@uni.edu`,
  university: 'Uni',
  _count: { followers, createdLabs: labs },
});

const makePrisma = () => ({
  user: { findFirst: jest.fn(), findMany: jest.fn() },
  instructorFollow: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  labInstance: { findMany: jest.fn() },
});

describe('FollowService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: FollowService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new FollowService(prisma as unknown as PrismaService);
  });

  describe('follow', () => {
    it('rejects following yourself', async () => {
      await expect(service.follow('u1', 'u1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.instructorFollow.upsert).not.toHaveBeenCalled();
    });

    it('rejects a user who is not an instructor', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.follow('s1', 'student-2')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'student-2', userType: 'INSTRUCTOR' },
        }),
      );
      expect(prisma.instructorFollow.upsert).not.toHaveBeenCalled();
    });

    it('upserts so following twice is a no-op', async () => {
      prisma.user.findFirst.mockResolvedValue(instructorRow('i1'));
      prisma.instructorFollow.count.mockResolvedValue(1);

      await service.follow('s1', 'i1');
      const result = await service.follow('s1', 'i1');

      expect(prisma.instructorFollow.upsert).toHaveBeenCalledWith({
        where: {
          studentId_instructorId: { studentId: 's1', instructorId: 'i1' },
        },
        create: { studentId: 's1', instructorId: 'i1' },
        update: {},
      });
      expect(result).toEqual({
        instructorId: 'i1',
        following: true,
        followerCount: 1,
      });
    });
  });

  it('unfollow deletes the pair and returns the new count', async () => {
    prisma.instructorFollow.count.mockResolvedValue(0);

    const result = await service.unfollow('s1', 'i1');

    expect(prisma.instructorFollow.deleteMany).toHaveBeenCalledWith({
      where: { studentId: 's1', instructorId: 'i1' },
    });
    expect(result).toEqual({
      instructorId: 'i1',
      following: false,
      followerCount: 0,
    });
  });

  describe('listInstructors', () => {
    it('marks the instructors the student follows', async () => {
      prisma.user.findMany.mockResolvedValue([
        instructorRow('i1', 3, 2),
        instructorRow('i2', 0, 1),
      ]);
      prisma.instructorFollow.findMany.mockResolvedValue([
        { instructorId: 'i2' },
      ]);

      const result = await service.listInstructors('s1');

      expect(result.map((i) => [i.id, i.isFollowing])).toEqual([
        ['i1', false],
        ['i2', true],
      ]);
      expect(result[0]).toMatchObject({ followerCount: 3, labCount: 2 });
    });

    it('returns isFollowing false for non-students without a follow query', async () => {
      prisma.user.findMany.mockResolvedValue([instructorRow('i1')]);

      const result = await service.listInstructors(null);

      expect(result[0].isFollowing).toBe(false);
      expect(prisma.instructorFollow.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getInstructorProfile', () => {
    it('returns the profile, follow state and labs', async () => {
      prisma.user.findFirst.mockResolvedValue(instructorRow('i1', 1, 1));
      prisma.labInstance.findMany.mockResolvedValue([{ id: 'lab-1' }]);
      prisma.instructorFollow.findUnique.mockResolvedValue({ id: 'f1' });

      const result = await service.getInstructorProfile('s1', 'i1');

      expect(result).toMatchObject({
        id: 'i1',
        isFollowing: true,
        labs: [{ id: 'lab-1' }],
      });
    });

    it('throws for an unknown instructor', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.getInstructorProfile('s1', 'nope'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  it('findFollowedLabs filters labs by the student follows', async () => {
    prisma.labInstance.findMany.mockResolvedValue([]);

    await service.findFollowedLabs('s1');

    expect(prisma.labInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { instructor: { followers: { some: { studentId: 's1' } } } },
      }),
    );
  });
});
