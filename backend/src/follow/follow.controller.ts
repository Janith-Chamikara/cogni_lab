import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type { User as ClerkUser } from '@clerk/backend';
import { FollowService } from './follow.service';
import { PrismaService } from '../prisma/prisma.service';

interface AuthenticatedRequest extends Request {
  user: ClerkUser;
}

@Controller('follow')
export class FollowController {
  constructor(
    private readonly followService: FollowService,
    private readonly prisma: PrismaService,
  ) {}

  // Role comes from Clerk publicMetadata (set at onboarding), with the local
  // userType column as a fallback, the same as LabController.
  private async getActor(clerkUser: ClerkUser) {
    const user = await this.prisma.user.findUnique({
      where: { clerkUserId: clerkUser.id },
      select: { id: true, userType: true },
    });

    if (!user) {
      throw new BadRequestException('User not found in database');
    }

    const metadataRole = clerkUser.publicMetadata?.role;
    const role = (
      typeof metadataRole === 'string' ? metadataRole : (user.userType ?? '')
    ).toUpperCase();

    return { userId: user.id, isStudent: role === 'STUDENT' };
  }

  /** Only students can follow, unfollow or have a following feed. */
  private async requireStudent(clerkUser: ClerkUser): Promise<string> {
    const actor = await this.getActor(clerkUser);

    if (!actor.isStudent) {
      throw new ForbiddenException('Only students can follow instructors');
    }

    return actor.userId;
  }

  /** The viewer's id if they are a student, else null (no follow state). */
  private async getStudentIdOrNull(clerkUser: ClerkUser) {
    const actor = await this.getActor(clerkUser);
    return actor.isStudent ? actor.userId : null;
  }

  @Get('instructors')
  async listInstructors(@Req() req: AuthenticatedRequest) {
    const studentId = await this.getStudentIdOrNull(req.user);
    return this.followService.listInstructors(studentId);
  }

  @Get('me/labs')
  async findFollowedLabs(@Req() req: AuthenticatedRequest) {
    const studentId = await this.requireStudent(req.user);
    return this.followService.findFollowedLabs(studentId);
  }

  @Get('instructors/:id')
  async getInstructorProfile(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const studentId = await this.getStudentIdOrNull(req.user);
    return this.followService.getInstructorProfile(studentId, id);
  }

  @Post('instructors/:id')
  async follow(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const studentId = await this.requireStudent(req.user);
    return this.followService.follow(studentId, id);
  }

  @Delete('instructors/:id')
  async unfollow(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const studentId = await this.requireStudent(req.user);
    return this.followService.unfollow(studentId, id);
  }
}
