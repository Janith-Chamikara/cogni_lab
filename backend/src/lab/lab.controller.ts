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
import {
  CreateLabDto,
  UpdateLabDto,
  UpdateLabEquipmentsDto,
  UpdateLabStepsDto,
  UpdateWireConnectionsDto,
} from './dto/lab.dto';
import { PrismaService } from '../prisma/prisma.service';

interface AuthenticatedRequest extends Request {
  user: ClerkUser;
}

@Controller('labs')
export class LabController {
  constructor(
    private readonly labService: LabService,
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

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.labService.delete(id);
  }
}
