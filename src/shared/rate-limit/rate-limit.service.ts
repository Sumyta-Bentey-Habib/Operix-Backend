import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import type { ApiRateLimitScope } from '../../../generated/prisma/enums.js';
import type { ApplicationConfiguration } from '../../config/configuration.js';
import { PrismaService } from '../../database/prisma.service.js';
import { APP_ERROR_CODE } from '../errors/app-error-code.constant.js';
import { AppException } from '../errors/app.exception.js';
import {
  API_RATE_LIMIT_CLEANUP_BATCH_SIZE,
  API_RATE_LIMIT_POLICIES,
  API_RATE_LIMIT_RETENTION_MS,
  API_RATE_LIMIT_WINDOW_MS,
} from './rate-limit.constant.js';
import type { ApiRateLimitResult } from './rate-limit.interface.js';

@Injectable()
export class ApiRateLimitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<ApplicationConfiguration, true>,
  ) {}

  async consume(
    scope: ApiRateLimitScope,
    internalUserId: string,
    now = new Date(),
  ): Promise<ApiRateLimitResult> {
    const policy = API_RATE_LIMIT_POLICIES[scope];
    const windowStartMs =
      Math.floor(now.getTime() / API_RATE_LIMIT_WINDOW_MS) *
      API_RATE_LIMIT_WINDOW_MS;
    const windowStart = new Date(windowStartMs);
    const windowEndMs = windowStartMs + API_RATE_LIMIT_WINDOW_MS;
    const expiresAt = new Date(windowEndMs + API_RATE_LIMIT_RETENTION_MS);
    const subjectHash = createHmac(
      'sha256',
      this.config.get('rateLimit.apiSecret', { infer: true }),
    )
      .update(`user:${internalUserId}`)
      .digest('hex');

    const bucket = await this.prisma.apiRateLimitBucket.upsert({
      where: {
        scope_subjectHash_windowStart: { scope, subjectHash, windowStart },
      },
      create: { scope, subjectHash, windowStart, expiresAt, count: 1 },
      update: { count: { increment: 1 } },
      select: { count: true },
    });
    const retryAfter = Math.max(
      1,
      Math.ceil((windowEndMs - now.getTime()) / 1_000),
    );

    if (bucket.count > policy.limit) {
      throw new AppException(
        HttpStatus.TOO_MANY_REQUESTS,
        APP_ERROR_CODE.RATE_LIMITED,
        'Too many requests.',
        { retryAfter },
      );
    }

    return { count: bucket.count, retryAfter };
  }

  async cleanupExpired(now = new Date()): Promise<number> {
    const expired = await this.prisma.apiRateLimitBucket.findMany({
      where: { expiresAt: { lte: now } },
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
      take: API_RATE_LIMIT_CLEANUP_BATCH_SIZE,
      select: { id: true },
    });
    if (expired.length === 0) return 0;

    const deleted = await this.prisma.apiRateLimitBucket.deleteMany({
      where: { id: { in: expired.map((bucket) => bucket.id) } },
    });
    return deleted.count;
  }
}
