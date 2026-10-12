import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type { User as ClerkUser } from '@clerk/backend';
import { AiService } from './ai.service';
import { parseChatRequest, parseProgressFeedbackRequest } from './ai-request';
import { PrismaService } from '../prisma/prisma.service';
import type { LabActor } from '../lab/lab.service';

interface AuthenticatedRequest extends Request {
  user: ClerkUser;
}

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
  ) {}

  // Who is asking decides which labs the assistant may read (students only
  // see published labs). Same role lookup as LabController.
  private async getViewer(clerkUser: ClerkUser): Promise<LabActor> {
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
    const isAdmin = role === 'ADMIN';

    return {
      userId: user.id,
      isAdmin,
      isInstructor: isAdmin || role === 'INSTRUCTOR',
    };
  }

  @Post('chat')
  async chat(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const viewer = await this.getViewer(req.user);
    return this.aiService.chat(parseChatRequest(body), viewer);
  }

  /** AI explanation of a Check Progress result for the current workspace. */
  @Post('progress-feedback')
  async progressFeedback(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const viewer = await this.getViewer(req.user);
    return this.aiService.progressFeedback(
      parseProgressFeedbackRequest(body),
      viewer,
    );
  }
}
