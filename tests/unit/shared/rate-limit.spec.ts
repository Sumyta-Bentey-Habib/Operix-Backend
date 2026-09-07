import { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ThrottlerLimitDetail, ThrottlerStorage } from '@nestjs/throttler';
import { readFileSync } from 'node:fs';
import {
  ApiRateLimitScope,
  UserRole,
  UserStatus,
} from '../../../generated/prisma/enums';
import { APP_ERROR_CODE } from '../../../src/shared/errors/app-error-code.constant';
import { OperixThrottlerGuard } from '../../../src/shared/rate-limit/operix-throttler.guard';
import { DistributedRateLimitGuard } from '../../../src/shared/rate-limit/rate-limit.guard';
import { ApiRateLimitService } from '../../../src/shared/rate-limit/rate-limit.service';

const jestApi = import.meta.jest;

class ExposedOperixThrottlerGuard extends OperixThrottlerGuard {
  reject(detail: ThrottlerLimitDetail) {
    return this.throwThrottlingException({} as ExecutionContext, detail);
  }
}

describe('ApiRateLimitService', () => {
  function setup(count = 1) {
    const prisma = {
      apiRateLimitBucket: {
        upsert: jestApi.fn().mockResolvedValue({ count }),
        findMany: jestApi.fn().mockResolvedValue([]),
        deleteMany: jestApi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const config = new ConfigService({
      rateLimit: {
        apiSecret: 'api-rate-limit-secret-at-least-32-characters',
      },
    });
    return {
      prisma,
      service: new ApiRateLimitService(prisma as never, config as never),
    };
  }

  it('uses an HMAC subject and one atomic upsert per attempt', async () => {
    const { service, prisma } = setup();
    const now = new Date('2026-09-07T10:42:37.500Z');

    await expect(
      service.consume(ApiRateLimitScope.TODO_CREATE, 'private-user-id', now),
    ).resolves.toEqual({ count: 1, retryAfter: 23 });

    const calls = prisma.apiRateLimitBucket.upsert.mock.calls as unknown as [
      [
        {
          where: {
            scope_subjectHash_windowStart: {
              scope: ApiRateLimitScope;
              subjectHash: string;
              windowStart: Date;
            };
          };
          create: { expiresAt: Date };
          update: { count: { increment: number } };
        },
      ],
    ];
    const input = calls[0][0];
    expect(input.where.scope_subjectHash_windowStart).toEqual({
      scope: ApiRateLimitScope.TODO_CREATE,
      subjectHash: expect.stringMatching(/^[0-9a-f]{64}$/) as string,
      windowStart: new Date('2026-09-07T10:42:00.000Z'),
    });
    expect(JSON.stringify(input)).not.toContain('private-user-id');
    expect(input.create.expiresAt).toEqual(
      new Date('2026-09-08T10:43:00.000Z'),
    );
    expect(input.update).toEqual({ count: { increment: 1 } });
  });

  it('rejects the attempt after the policy limit with its own retry time', async () => {
    const { service } = setup(31);

    await expect(
      service.consume(
        ApiRateLimitScope.TODO_CREATE,
        'private-user-id',
        new Date('2026-09-07T10:42:59.900Z'),
      ),
    ).rejects.toMatchObject({ status: 429 });

    await service
      .consume(
        ApiRateLimitScope.TODO_CREATE,
        'private-user-id',
        new Date('2026-09-07T10:42:59.900Z'),
      )
      .catch((error: { getResponse: () => unknown }) => {
        expect(error.getResponse()).toEqual({
          message: 'Too many requests.',
          code: APP_ERROR_CODE.RATE_LIMITED,
          details: { retryAfter: 1 },
        });
      });
  });

  it('deletes at most the selected expired bucket batch', async () => {
    const { service, prisma } = setup();
    prisma.apiRateLimitBucket.findMany.mockResolvedValue([
      { id: 'bucket-a' },
      { id: 'bucket-b' },
    ]);
    prisma.apiRateLimitBucket.deleteMany.mockResolvedValue({ count: 2 });

    await expect(
      service.cleanupExpired(new Date('2026-09-07T10:00:00.000Z')),
    ).resolves.toBe(2);
    expect(prisma.apiRateLimitBucket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1_000 }),
    );
    expect(prisma.apiRateLimitBucket.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['bucket-a', 'bucket-b'] } },
    });
  });
});

describe('global throttler registration', () => {
  it('registers exactly one global throttler guard', () => {
    const source = readFileSync(
      new URL('../../../src/app.module.ts', import.meta.url),
      'utf8',
    );

    expect(source.match(/provide:\s*APP_GUARD/g)).toHaveLength(1);
    expect(source).toContain('useClass: OperixThrottlerGuard');
    expect(source).not.toMatch(/useClass:\s*ThrottlerGuard/);
  });
});

describe('DistributedRateLimitGuard', () => {
  function context(request: Record<string, unknown>): ExecutionContext {
    return {
      getHandler: () => context,
      getClass: () => class TestController {},
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => undefined,
        getNext: () => undefined,
      }),
    } as unknown as ExecutionContext;
  }

  it('uses the hydrated private viewer identity', async () => {
    const reflector = {
      getAllAndOverride: jestApi
        .fn()
        .mockReturnValue(ApiRateLimitScope.TODO_DELETE),
    };
    const limiter = { consume: jestApi.fn().mockResolvedValue({}) };
    const guard = new DistributedRateLimitGuard(
      reflector as never,
      limiter as never,
    );

    await expect(
      guard.canActivate(
        context({
          operixViewer: {
            userId: 'private-user-id',
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
            scope: { type: 'ADMIN', teamIds: [] },
          },
        }),
      ),
    ).resolves.toBe(true);
    expect(limiter.consume).toHaveBeenCalledWith(
      ApiRateLimitScope.TODO_DELETE,
      'private-user-id',
    );
  });

  it('does not consume quota without an authorized viewer context', async () => {
    const reflector = {
      getAllAndOverride: jestApi
        .fn()
        .mockReturnValue(ApiRateLimitScope.TODO_CREATE),
    };
    const limiter = { consume: jestApi.fn() };
    const guard = new DistributedRateLimitGuard(
      reflector as never,
      limiter as never,
    );

    await expect(guard.canActivate(context({}))).rejects.toMatchObject({
      status: 401,
    });
    expect(limiter.consume).not.toHaveBeenCalled();
  });
});

describe('OperixThrottlerGuard', () => {
  it('maps the installed throttler retry duration to the Operix exception', async () => {
    const guard = new ExposedOperixThrottlerGuard(
      [{ name: 'default', ttl: 60_000, limit: 100 }],
      {} as ThrottlerStorage,
      new Reflector(),
    );
    const detail: ThrottlerLimitDetail = {
      ttl: 60_000,
      limit: 100,
      key: 'key',
      tracker: 'tracker',
      totalHits: 101,
      timeToExpire: 40,
      isBlocked: true,
      timeToBlockExpire: 39.2,
    };

    await guard
      .reject(detail)
      .catch((error: { getResponse: () => unknown }) => {
        expect(error.getResponse()).toEqual({
          message: 'Too many requests.',
          code: APP_ERROR_CODE.RATE_LIMITED,
          details: { retryAfter: 40 },
        });
      });
  });
});
