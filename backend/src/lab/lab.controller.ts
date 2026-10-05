import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Req,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { User as ClerkUser } from '@clerk/backend';
import { LabService } from './lab.service';
import { LabAttemptService } from './lab-attempt.service';
import {
  CreateLabDto,
  UpdateLabDto,
  UpdateLabEquipmentsDto,
  UpdateLabStepsDto,
  UpdateWireConnectionsDto,
  UpdateCircuitRulesDto,
  StudentCircuitDto,
} from './dto/lab.dto';
import { PrismaService } from '../prisma/prisma.service';

interface AuthenticatedRequest extends Request {
  user: ClerkUser;
}

@Controller('labs')
export class LabController {
  constructor(
    private readonly labService: LabService,
    private readonly labAttemptService: LabAttemptService,
    private readonly prisma: PrismaService,
  ) {}

  private async getDbUserId(clerkUser: ClerkUser): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { clerkUserId: clerkUser.id },
      select: { id: true },
    });

    if (!user) {
      throw new BadRequestException('User not found in database');
    }

    return user.id;
  }

  // Role comes from Clerk publicMetadata (set at onboarding); the local
  // userType column is only filled by the webhook, so it is a fallback.
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
    const isAdmin = role === 'ADMIN';

    return {
      userId: user.id,
      isAdmin,
      isInstructor: isAdmin || role === 'INSTRUCTOR',
    };
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateLabDto) {
    const instructorId = await this.getDbUserId(req.user);
    return this.labService.create(instructorId, dto);
  }

  @Get()
  async findAll() {
    return this.labService.findAll();
  }

  @Get('my-labs')
  async findMyLabs(@Req() req: AuthenticatedRequest) {
    const instructorId = await this.getDbUserId(req.user);
    return this.labService.findByInstructor(instructorId);
  }

  @Get('stats')
  async getStats(@Req() req: AuthenticatedRequest) {
    const instructorId = await this.getDbUserId(req.user);
    return this.labService.getStats(instructorId);
  }

  // Declared before ':id' so "my-attempts" is not treated as a lab id.
  @Get('my-attempts')
  async findMyAttemptSummary(@Req() req: AuthenticatedRequest) {
    const userId = await this.getDbUserId(req.user);
    return this.labAttemptService.findMySummary(userId);
  }

  @Get('module/:moduleId')
  async findByModule(@Param('moduleId') moduleId: string) {
    return this.labService.findByModule(moduleId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.labService.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateLabDto) {
    return this.labService.update(id, dto);
  }

  @Put(':id/equipments')
  async updateEquipments(
    @Param('id') id: string,
    @Body() dto: UpdateLabEquipmentsDto,
  ) {
    return this.labService.updateEquipments(id, dto);
  }

  @Put(':id/steps')
  async updateSteps(@Param('id') id: string, @Body() dto: UpdateLabStepsDto) {
    return this.labService.updateSteps(id, dto);
  }

  @Put(':id/connections')
  async updateConnections(
    @Param('id') id: string,
    @Body() dto: UpdateWireConnectionsDto,
  ) {
    return this.labService.updateConnections(id, dto);
  }

  @Put(':id/rules')
  async updateRules(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCircuitRulesDto,
  ) {
    const actor = await this.getActor(req.user);
    return this.labService.updateRules(id, actor, dto?.rules ?? null);
  }

  @Post(':id/validate')
  async validateCircuit(
    @Param('id') id: string,
    @Body() dto: StudentCircuitDto,
  ) {
    return this.labAttemptService.validate(id, dto);
  }

  @Post(':id/attempts')
  async submitAttempt(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: StudentCircuitDto,
  ) {
    const userId = await this.getDbUserId(req.user);
    return this.labAttemptService.submit(id, userId, dto);
  }

  @Get(':id/attempts/me')
  async findMyAttempts(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const userId = await this.getDbUserId(req.user);
    return this.labAttemptService.findMine(id, userId);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.labService.delete(id);
  }
}
