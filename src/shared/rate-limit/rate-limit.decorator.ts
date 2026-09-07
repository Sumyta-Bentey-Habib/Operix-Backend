import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import type { ApiRateLimitScope } from '../../../generated/prisma/enums.js';
import { API_RATE_LIMIT_METADATA_KEY } from './rate-limit.constant.js';
import { DistributedRateLimitGuard } from './rate-limit.guard.js';

export function DistributedRateLimit(scope: ApiRateLimitScope) {
  return applyDecorators(
    SetMetadata(API_RATE_LIMIT_METADATA_KEY, scope),
    UseGuards(DistributedRateLimitGuard),
  );
}
