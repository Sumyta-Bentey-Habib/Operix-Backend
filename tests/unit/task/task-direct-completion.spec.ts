import {
  TaskCompletionMode,
  TaskPriority,
  TaskStatus,
  UserRole,
  UserStatus,
} from '../../../generated/prisma/enums';
import { PrismaService } from '../../../src/database/prisma.service';
import { TaskService } from '../../../src/modules/task/task.service';
import type { OperixViewer } from '../../../src/shared/auth/viewer.interface';

const jestApi = import.meta.jest;

const viewer: OperixViewer = {
  userId: 'responsible-db',
  role: UserRole.ADMIN,
  status: UserStatus.ACTIVE,
  scope: { type: 'ADMIN', teamIds: ['team-db'] },
};

describe('TaskService direct completion', () => {
  it('completes once, normalizes the note, and cancels a pending reminder', async () => {
    const updated = {
      id: 'task-db',
      publicId: '11111111-1111-4111-8111-111111111111',
      referenceCode: 'TASK-20260907-ABC123',
      title: 'Direct work',
      description: null,
      remarks: null,
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.COMPLETED,
      dueAt: new Date('2026-09-08T11:00:00.000Z'),
      startedAt: new Date('2026-09-07T10:00:00.000Z'),
      completedAt: new Date('2026-09-07T11:00:00.000Z'),
      cancelledAt: null,
      completionMode: TaskCompletionMode.DIRECT,
      completionNote: 'Done safely',
      scheduledStartAt: null,
      occurrenceKey: null,
      team: { publicId: 'team-public', name: 'Operations' },
      category: null,
      createdBy: {
        publicId: 'owner-public',
        name: 'Owner',
        role: UserRole.ADMIN,
        employeeId: null,
        designation: null,
      },
      assignments: [
        {
          responsibleUser: {
            publicId: 'responsible-public',
            name: 'Responsible',
            role: UserRole.ADMIN,
            employeeId: null,
            designation: null,
          },
        },
      ],
      recurrence: null,
      reminder: null,
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      updatedAt: new Date('2026-09-07T11:00:00.000Z'),
    };
    const tx = {
      task: {
        findFirst: jestApi.fn().mockResolvedValue({
          id: 'task-db',
          status: TaskStatus.IN_PROGRESS,
          completionMode: TaskCompletionMode.DIRECT,
          recurrenceId: null,
        }),
        update: jestApi.fn().mockResolvedValue(updated),
      },
      taskAssignment: {
        findFirst: jestApi.fn().mockResolvedValue({
          id: 'assignment-db',
          responsibleUserId: 'responsible-db',
        }),
      },
      taskReminder: {
        updateMany: jestApi.fn().mockResolvedValue({ count: 1 }),
      },
      taskStatusHistory: {
        create: jestApi.fn().mockResolvedValue({ id: 'history-db' }),
      },
      activityLog: {
        create: jestApi.fn().mockResolvedValue({ id: 'activity-db' }),
      },
    };
    const prisma = {
      $transaction: jestApi.fn(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new TaskService(prisma, {
      sendTaskAssignedEmail: jestApi.fn(),
    } as never);

    const result = await service.completeTask(
      viewer,
      '11111111-1111-4111-8111-111111111111',
      { completionNote: '  Done safely  ' },
    );

    expect(result.status).toBe(TaskStatus.COMPLETED);
    const updateMock = tx.task.update as unknown as {
      mock: {
        calls: [{ data: { completionNote?: string | null } }][];
      };
    };
    expect(updateMock.mock.calls[0]?.[0].data.completionNote).toBe(
      'Done safely',
    );
    expect(tx.taskReminder.updateMany).toHaveBeenCalledWith({
      where: { taskId: 'task-db', status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
  });
});
