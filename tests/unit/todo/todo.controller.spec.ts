import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Type } from '@nestjs/common';
import { ApiRateLimitScope, UserRole } from '../../../generated/prisma/enums';
import { AccountStatusGuard } from '../../../src/shared/auth/account-status.guard';
import { OPERIX_REQUIRED_ROLES_METADATA_KEY } from '../../../src/shared/auth/auth-metadata.constant';
import { OperixRoleGuard } from '../../../src/shared/auth/operix-role.guard';
import { ViewerContextGuard } from '../../../src/shared/auth/viewer-context.guard';
import { API_RATE_LIMIT_METADATA_KEY } from '../../../src/shared/rate-limit/rate-limit.constant';
import { DistributedRateLimitGuard } from '../../../src/shared/rate-limit/rate-limit.guard';
import { TodoController } from '../../../src/modules/todo/todo.controller';

describe('TodoController authorization and limiter contract', () => {
  it('runs viewer, account-status, and role guards before method-level distributed limiting', () => {
    const handlers = TodoController.prototype as unknown as { create: object };
    const createHandler = handlers.create;
    const classGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      TodoController,
    ) as Type[];
    const createGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      createHandler,
    ) as Type[];

    expect(classGuards).toEqual([
      ViewerContextGuard,
      AccountStatusGuard,
      OperixRoleGuard,
    ]);
    expect(createGuards).toEqual([DistributedRateLimitGuard]);
  });

  it('permits only Super Admin and Admin and uses a closed create scope', () => {
    const handlers = TodoController.prototype as unknown as { create: object };
    const createHandler = handlers.create;
    expect(
      Reflect.getMetadata(OPERIX_REQUIRED_ROLES_METADATA_KEY, TodoController),
    ).toEqual([UserRole.SUPER_ADMIN, UserRole.ADMIN]);
    expect(
      Reflect.getMetadata(API_RATE_LIMIT_METADATA_KEY, createHandler),
    ).toBe(ApiRateLimitScope.TODO_CREATE);
  });
});
