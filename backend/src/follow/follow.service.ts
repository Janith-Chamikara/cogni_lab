import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FollowStatusDto,
  InstructorProfileDto,
  InstructorSummaryDto,
} from './dto/follow.dto';

// Public instructor fields plus follower and lab counts.
const instructorSelect = {
  id: true,
  fullName: true,
  email: true,
  university: true,
  _count: {
    select: {
      followers: true,
      createdLabs: { where: { publishStatus: 'PUBLISHED' } },
    },
  },
} as const;

// Same lab shape as LabService.findAll, so lab cards work unchanged.
const labInclude = {
  instructor: {
    select: { id: true, fullName: true, email: true, university: true },
  },
  module: {
    select: { id: true, moduleName: true, moduleCode: true },
  },
  _count: {
    select: {
      experimentSteps: true,
      labEquipments: true,
      experimentProgress: true,
    },
  },
} as const;

type InstructorRow = {
  id: string;
  fullName: string | null;
  email: string;
  university: string | null;
  _count: { followers: number; createdLabs: number };
};

const toSummary = (
  row: InstructorRow,
  isFollowing: boolean,
): InstructorSummaryDto => ({
  id: row.id,
  fullName: row.fullName,
  email: row.email,
  university: row.university,
  followerCount: row._count.followers,
  labCount: row._count.createdLabs,
  isFollowing,
});

@Injectable()
export class FollowService {
  constructor(private readonly prisma: PrismaService) {}

  /** Throws unless the user exists and is an instructor. */
  private async findInstructor(instructorId: string) {
    const instructor = await this.prisma.user.findFirst({
      where: { id: instructorId, userType: 'INSTRUCTOR' },
      select: instructorSelect,
    });

    if (!instructor) {
      throw new NotFoundException(
        `Instructor with ID ${instructorId} not found`,
      );
    }

    return instructor;
  }

  private async status(
    instructorId: string,
    following: boolean,
  ): Promise<FollowStatusDto> {
    const followerCount = await this.prisma.instructorFollow.count({
      where: { instructorId },
    });
    return { instructorId, following, followerCount };
  }

  /** Following twice is a no-op. */
  async follow(
    studentId: string,
    instructorId: string,
  ): Promise<FollowStatusDto> {
    if (studentId === instructorId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    await this.findInstructor(instructorId);

    await this.prisma.instructorFollow.upsert({
      where: { studentId_instructorId: { studentId, instructorId } },
      create: { studentId, instructorId },
      update: {},
    });

    return this.status(instructorId, true);
  }

  /** Unfollowing someone you do not follow is a no-op. */
  async unfollow(
    studentId: string,
    instructorId: string,
  ): Promise<FollowStatusDto> {
    await this.prisma.instructorFollow.deleteMany({
      where: { studentId, instructorId },
    });

    return this.status(instructorId, false);
  }

  /** Ids of the instructors this user follows; empty for non-students. */
  private async followedIds(userId: string | null): Promise<Set<string>> {
    if (!userId) return new Set();

    const follows = await this.prisma.instructorFollow.findMany({
      where: { studentId: userId },
      select: { instructorId: true },
    });
    return new Set(follows.map((follow) => follow.instructorId));
  }

  /** `studentId` is null when the viewer is not a student. */
  async listInstructors(
    studentId: string | null,
  ): Promise<InstructorSummaryDto[]> {
    const [instructors, followed] = await Promise.all([
      this.prisma.user.findMany({
        where: { userType: 'INSTRUCTOR' },
        select: instructorSelect,
        orderBy: [{ fullName: 'asc' }, { email: 'asc' }],
      }),
      this.followedIds(studentId),
    ]);

    return instructors.map((row) => toSummary(row, followed.has(row.id)));
  }

  async getInstructorProfile(
    studentId: string | null,
    instructorId: string,
  ): Promise<InstructorProfileDto> {
    const instructor = await this.findInstructor(instructorId);

    const [labs, follow] = await Promise.all([
      this.prisma.labInstance.findMany({
        where: { instructorId, publishStatus: 'PUBLISHED' },
        include: labInclude,
        orderBy: { createdAt: 'desc' },
      }),
      studentId
        ? this.prisma.instructorFollow.findUnique({
            where: { studentId_instructorId: { studentId, instructorId } },
            select: { id: true },
          })
        : null,
    ]);

    return { ...toSummary(instructor, Boolean(follow)), labs };
  }

  /** Labs from every instructor the student follows, newest first. */
  async findFollowedLabs(studentId: string) {
    return this.prisma.labInstance.findMany({
      where: {
        publishStatus: 'PUBLISHED',
        instructor: { followers: { some: { studentId } } },
      },
      include: labInclude,
      orderBy: { createdAt: 'desc' },
    });
  }
}
