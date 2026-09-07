import { randomUUID } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaClient } from '../../../../generated/prisma/client';
import {
  ApiRateLimitScope,
  TodoCategory,
  UserRole,
  UserStatus,
} from '../../../../generated/prisma/enums';
import type { ApplicationConfiguration } from '../../../../src/config/configuration';
import {
  formatTodoDate,
  parseTodoDate,
} from '../../../../src/modules/todo/todo-date.helper';
import { ApiRateLimitService } from '../../../../src/shared/rate-limit/rate-limit.service';
import { getTestDatabaseUrl } from '../../../support/database/test-database-url';

describe('Todo and generic API rate-limit persistence', () => {
  let pool: Pool | undefined;
  let prisma: PrismaClient | undefined;
  const userIds: string[] = [];

  beforeAll(() => {
    const testPool = new Pool({ connectionString: getTestDatabaseUrl() });
    pool = testPool;
    prisma = new PrismaClient({ adapter: new PrismaPg(testPool) });
  });

  afterEach(async () => {
    if (!prisma) return;
    await prisma.apiRateLimitBucket.deleteMany({
      where: { windowStart: new Date('2099-01-01T00:00:00.000Z') },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await pool?.end();
  });

  it('stores a date-only Todo with a generated public UUID and cascades it with its owner', async () => {
    const client = getClient(prisma);
    const user = await createUser(client, userIds);
    const todo = await client.todoItem.create({
      data: {
        ownerId: user.id,
        title: 'Review audit checklist',
        category: TodoCategory.COMPLIANCE,
        dueOn: parseTodoDate('2099-01-07'),
        tags: ['audit'],
      },
    });

    expect(todo.publicId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(formatTodoDate(todo.dueOn!)).toBe('2099-01-07');

    await client.user.delete({ where: { id: user.id } });
    userIds.splice(userIds.indexOf(user.id), 1);
    await expect(
      client.todoItem.findUnique({ where: { id: todo.id } }),
    ).resolves.toBeNull();
  });

  it('atomically counts concurrent attempts in one distributed fixed window', async () => {
    const client = getClient(prisma);
    const config = new ConfigService<ApplicationConfiguration, true>({
      rateLimit: {
        apiSecret: 'integration-api-rate-limit-secret-32-characters',
      },
    });
    const service = new ApiRateLimitService(client as never, config);
    const now = new Date('2099-01-01T00:00:10.000Z');

    const attempts = await Promise.allSettled(
      Array.from({ length: 40 }, () =>
        service.consume(ApiRateLimitScope.TODO_CREATE, 'integration-user', now),
      ),
    );

    expect(
      attempts.filter((attempt) => attempt.status === 'fulfilled'),
    ).toHaveLength(30);
    expect(
      attempts.filter((attempt) => attempt.status === 'rejected'),
    ).toHaveLength(10);
    await expect(
      client.apiRateLimitBucket.findFirstOrThrow({
        where: {
          scope: ApiRateLimitScope.TODO_CREATE,
          windowStart: new Date('2099-01-01T00:00:00.000Z'),
        },
        select: { count: true, subjectHash: true },
      }),
    ).resolves.toMatchObject({
      count: 40,
      subjectHash: expect.stringMatching(/^[0-9a-f]{64}$/) as string,
    });
  });
});

function getClient(client: PrismaClient | undefined): PrismaClient {
  if (!client) throw new Error('Prisma test client was not initialized');
  return client;
}

async function createUser(client: PrismaClient, trackedIds: string[]) {
  const id = `todo-test-${randomUUID()}`;
  trackedIds.push(id);
  return client.user.create({
    data: {
      id,
      publicId: randomUUID(),
      name: 'Todo Test Admin',
      email: `${id}@example.com`,
      emailVerified: true,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });
}
