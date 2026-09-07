import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole, UserStatus } from '../../../generated/prisma/enums';
import { TodoController } from '../../../src/modules/todo/todo.controller';
import { TodoService } from '../../../src/modules/todo/todo.service';
import { OperixAuthService } from '../../../src/modules/auth/auth.service';
import { AccountStatusGuard } from '../../../src/shared/auth/account-status.guard';
import { OperixRoleGuard } from '../../../src/shared/auth/operix-role.guard';
import { ViewerContextGuard } from '../../../src/shared/auth/viewer-context.guard';
import type { OperixViewer } from '../../../src/shared/auth/viewer.interface';
import { DistributedRateLimitGuard } from '../../../src/shared/rate-limit/rate-limit.guard';
import { ApiRateLimitService } from '../../../src/shared/rate-limit/rate-limit.service';

const jestApi = import.meta.jest;

describe('Todo distributed limiter execution order', () => {
  let app: INestApplication | undefined;
  let currentViewer: OperixViewer | null;
  const consume = jestApi.fn().mockResolvedValue({ count: 1, retryAfter: 60 });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TodoController],
      providers: [
        Reflector,
        AccountStatusGuard,
        OperixRoleGuard,
        DistributedRateLimitGuard,
        ViewerContextGuard,
        {
          provide: OperixAuthService,
          useValue: {
            getViewer: jestApi.fn(() => Promise.resolve(currentViewer)),
          },
        },
        {
          provide: ApiRateLimitService,
          useValue: { consume },
        },
        {
          provide: TodoService,
          useValue: { create: jestApi.fn().mockResolvedValue({ id: 'safe' }) },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(
      (req: { user?: { id: string } }, _res: unknown, next: () => void) => {
        if (currentViewer) req.user = { id: currentViewer.userId };
        next();
      },
    );
    await app.init();
  });

  beforeEach(() => consume.mockClear());

  afterAll(async () => {
    await app?.close();
  });

  it.each([
    ['unauthenticated', null, 401],
    ['suspended Admin', viewer(UserRole.ADMIN, UserStatus.SUSPENDED), 403],
    ['active Member', viewer(UserRole.MEMBER, UserStatus.ACTIVE), 403],
  ])(
    'does not consume quota for %s requests',
    async (_name, identity, status) => {
      currentViewer = identity;

      await request(getServer(app))
        .post('/todos')
        .send({ title: 'Not permitted' })
        .expect(status);
      expect(consume).not.toHaveBeenCalled();
    },
  );
});

function viewer(role: UserRole, status: UserStatus): OperixViewer {
  return { userId: `private-${role}`, role, status, scope: { type: 'GLOBAL' } };
}

function getServer(application: INestApplication | undefined) {
  if (!application) throw new Error('Test application was not initialized');
  return application.getHttpServer() as Parameters<typeof request>[0];
}
