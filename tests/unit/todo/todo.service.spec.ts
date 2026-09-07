import { ConfigService } from '@nestjs/config';
import {
  TaskPriority,
  TodoCategory,
  UserRole,
  UserStatus,
} from '../../../generated/prisma/enums';
import {
  TodoSort,
  TodoStatusFilter,
} from '../../../src/modules/todo/todo.constant';
import { TodoService } from '../../../src/modules/todo/todo.service';
import type { OperixViewer } from '../../../src/shared/auth/viewer.interface';

const jestApi = import.meta.jest;

const viewer: OperixViewer = {
  userId: 'private-admin-id',
  role: UserRole.ADMIN,
  status: UserStatus.ACTIVE,
  scope: { type: 'ADMIN', teamIds: ['private-team-id'] },
};

function selectedTodo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'private-todo-id',
    publicId: '9d954564-1a14-468d-89ee-11027bf99ef4',
    title: 'Audit inventory',
    description: null,
    priority: TaskPriority.MEDIUM,
    category: TodoCategory.GENERAL,
    dueOn: null,
    tags: [],
    completedAt: null,
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    updatedAt: new Date('2026-09-01T10:00:00.000Z'),
    ...overrides,
  };
}

function createService(todo = selectedTodo()) {
  const prisma = {
    todoItem: {
      create: jestApi.fn().mockResolvedValue(todo),
      findMany: jestApi.fn().mockResolvedValue([todo]),
      findFirst: jestApi.fn().mockResolvedValue(todo),
      count: jestApi.fn().mockResolvedValue(1),
      update: jestApi.fn().mockResolvedValue(todo),
      updateMany: jestApi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jestApi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const config = new ConfigService({
    app: { businessTimezone: 'Asia/Dhaka' },
  });
  return {
    prisma,
    service: new TodoService(prisma as never, config as never),
  };
}

describe('TodoService', () => {
  beforeEach(() => {
    jestApi.useFakeTimers().setSystemTime(new Date('2026-09-07T10:00:00.000Z'));
  });

  afterEach(() => {
    jestApi.useRealTimers();
  });

  it('creates an owner scoped Todo with normalized content', async () => {
    const { service, prisma } = createService();

    await service.create(viewer, {
      title: '  Audit inventory  ',
      description: '   ',
      category: TodoCategory.OPERATIONS,
      dueDate: '2026-09-10',
      tags: [' Audit ', 'audit', ' Finance ', ''],
    });

    expect(prisma.todoItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          ownerId: viewer.userId,
          title: 'Audit inventory',
          description: null,
          priority: TaskPriority.MEDIUM,
          category: TodoCategory.OPERATIONS,
          dueOn: new Date('2026-09-10T00:00:00.000Z'),
          tags: ['audit', 'finance'],
        },
      }),
    );
  });

  it('builds exact overdue false and normalized search filters', async () => {
    const { service, prisma } = createService();

    await service.list(viewer, {
      status: TodoStatusFilter.ALL,
      overdue: false,
      q: '  Audit  ',
      sort: TodoSort.DUE_ON_ASC,
    });

    expect(prisma.todoItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ownerId: viewer.userId,
          OR: [
            { completedAt: { not: null } },
            { dueOn: null },
            { dueOn: { gte: new Date('2026-09-07T00:00:00.000Z') } },
          ],
          AND: [
            {
              OR: [
                { title: { contains: 'Audit', mode: 'insensitive' } },
                { description: { contains: 'Audit', mode: 'insensitive' } },
                { tags: { has: 'audit' } },
              ],
            },
          ],
        },
        orderBy: [
          { dueOn: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
      }),
    );
  });

  it('intersects completed status with overdue true instead of overriding the status filter', async () => {
    const { service, prisma } = createService();

    await service.list(viewer, {
      status: TodoStatusFilter.COMPLETED,
      overdue: true,
    });

    expect(prisma.todoItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ownerId: viewer.userId,
          completedAt: { not: null },
          AND: [
            {
              completedAt: null,
              dueOn: {
                not: null,
                lt: new Date('2026-09-07T00:00:00.000Z'),
              },
            },
          ],
        },
      }),
    );
  });

  it('calculates owner scoped summary values and rounds completion rate', async () => {
    const { service, prisma } = createService();
    prisma.todoItem.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    await expect(service.summary(viewer)).resolves.toEqual({
      total: 3,
      active: 2,
      completed: 1,
      urgent: 1,
      overdue: 1,
      completionRate: 33,
    });
    const countCalls = prisma.todoItem.count.mock.calls as [
      { where: { ownerId: string } },
    ][];
    for (const call of countCalls) {
      expect(call[0].where.ownerId).toBe(viewer.userId);
    }
  });

  it('returns a privacy safe not found error for an unowned Todo', async () => {
    const { service, prisma } = createService();
    prisma.todoItem.findFirst.mockResolvedValue(null);

    await expect(
      service.get(viewer, '9d954564-1a14-468d-89ee-11027bf99ef4'),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.todoItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          publicId: '9d954564-1a14-468d-89ee-11027bf99ef4',
          ownerId: viewer.userId,
        },
      }),
    );
  });

  it('does not rewrite the first completion timestamp', async () => {
    const completed = selectedTodo({
      completedAt: new Date('2026-09-05T10:00:00.000Z'),
    });
    const { service, prisma } = createService(completed);

    const result = await service.complete(
      viewer,
      '9d954564-1a14-468d-89ee-11027bf99ef4',
    );

    expect(prisma.todoItem.updateMany).not.toHaveBeenCalled();
    expect(result.completedAt).toBe('2026-09-05T10:00:00.000Z');
  });

  it('does not update an already active Todo when reopening', async () => {
    const { service, prisma } = createService();

    const result = await service.reopen(
      viewer,
      '9d954564-1a14-468d-89ee-11027bf99ef4',
    );

    expect(prisma.todoItem.updateMany).not.toHaveBeenCalled();
    expect(result.completed).toBe(false);
  });

  it('preserves completion while clearing nullable content and tags', async () => {
    const completed = selectedTodo({
      completedAt: new Date('2026-09-05T10:00:00.000Z'),
    });
    const { service, prisma } = createService(completed);
    prisma.todoItem.update.mockResolvedValue({
      ...completed,
      description: null,
      dueOn: null,
      tags: [],
    });

    const result = await service.update(
      viewer,
      '9d954564-1a14-468d-89ee-11027bf99ef4',
      { description: null, dueDate: null, tags: [] },
    );

    expect(prisma.todoItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { description: null, dueOn: null, tags: [] },
      }),
    );
    expect(result.completed).toBe(true);
  });

  it('clears only completed Todos owned by the viewer', async () => {
    const { service, prisma } = createService();

    await expect(service.clearCompleted(viewer)).resolves.toEqual({
      deleted: 1,
    });
    expect(prisma.todoItem.deleteMany).toHaveBeenCalledWith({
      where: { ownerId: viewer.userId, completedAt: { not: null } },
    });
  });
});
