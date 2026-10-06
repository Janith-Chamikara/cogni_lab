import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiToolsService } from './ai-tools.service';
import { LabModule } from '../lab/lab.module';
import { LabAttemptService } from '../lab/lab-attempt.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [LabModule],
  controllers: [AiController],
  providers: [AiService, AiToolsService, LabAttemptService, PrismaService],
})
export class AiModule {}
