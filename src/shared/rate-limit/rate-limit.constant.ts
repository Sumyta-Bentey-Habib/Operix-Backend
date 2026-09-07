import { ApiRateLimitScope } from '../../../generated/prisma/enums.js';
import type { ApiRateLimitPolicy } from './rate-limit.interface.js';

export const API_RATE_LIMIT_METADATA_KEY = 'operix:api_rate_limit_scope';
export const API_RATE_LIMIT_WINDOW_MS = 60_000;
export const API_RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;
export const API_RATE_LIMIT_CLEANUP_BATCH_SIZE = 1_000;

export const API_RATE_LIMIT_POLICIES: Record<
  ApiRateLimitScope,
  ApiRateLimitPolicy
> = {
  [ApiRateLimitScope.TODO_CREATE]: { limit: 30 },
  [ApiRateLimitScope.TODO_DELETE]: { limit: 30 },
  [ApiRateLimitScope.TODO_CLEAR_COMPLETED]: { limit: 5 },
};
