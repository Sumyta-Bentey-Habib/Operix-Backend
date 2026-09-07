import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { DistributedRateLimitGuard } from './rate-limit.guard.js';
import { ApiRateLimitService } from './rate-limit.service.js';

@Module({
  imports: [PrismaModule],
  providers: [ApiRateLimitService, DistributedRateLimitGuard],
  exports: [ApiRateLimitService, DistributedRateLimitGuard],
})
export class ApiRateLimitModule {}
