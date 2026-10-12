import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClerkClientProvider } from './providers/clerk-client.provider';
import { AuthModule } from './auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { ClerkAuthGuard } from './auth/guards/clerk-auth.guard';
import { LabEquipmentModule } from './lab-equipment/lab-equipment.module';
import { ModuleModule } from './module/module.module';
import { LabModule } from './lab/lab.module';
import { AiModule } from './ai/ai.module';
import { FollowModule } from './follow/follow.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    LabEquipmentModule,
    ModuleModule,
    LabModule,
    AiModule,
    FollowModule,
  ],
  providers: [
    ClerkClientProvider,
    {
      provide: APP_GUARD,
      useClass: ClerkAuthGuard,
    },
  ],
})
export class AppModule {}
