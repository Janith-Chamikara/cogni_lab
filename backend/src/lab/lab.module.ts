import { Module } from '@nestjs/common';
import { LabController } from './lab.controller';
import { LabService } from './lab.service';
import { LabAttemptService } from './lab-attempt.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [LabController],
  providers: [LabService, LabAttemptService, PrismaService],
  exports: [LabService],
})
export class LabModule {}
