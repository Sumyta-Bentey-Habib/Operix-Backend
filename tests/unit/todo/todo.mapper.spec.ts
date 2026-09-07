import { TaskPriority, TodoCategory } from '../../../generated/prisma/enums';
import { mapTodo } from '../../../src/modules/todo/todo.mapper';

const baseTodo = {
  id: 'private-todo-id',
  publicId: '9d954564-1a14-468d-89ee-11027bf99ef4',
  title: 'Review audit file',
  description: null,
  priority: TaskPriority.HIGH,
  category: TodoCategory.COMPLIANCE,
  dueOn: new Date('2026-09-06T00:00:00.000Z'),
  tags: ['audit'],
  completedAt: null,
  createdAt: new Date('2026-09-01T10:00:00.000Z'),
  updatedAt: new Date('2026-09-02T10:00:00.000Z'),
};

describe('mapTodo', () => {
  it('maps public identity, ISO timestamps, and overdue state safely', () => {
    const result = mapTodo(baseTodo, new Date('2026-09-07T00:00:00.000Z'));

    expect(result).toEqual({
      id: baseTodo.publicId,
      title: 'Review audit file',
      description: null,
      priority: TaskPriority.HIGH,
      category: TodoCategory.COMPLIANCE,
      dueDate: '2026-09-06',
      tags: ['audit'],
      completed: false,
      completedAt: null,
      isOverdue: true,
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-02T10:00:00.000Z',
    });
    expect(JSON.stringify(result)).not.toContain(baseTodo.id);
  });

  it('never marks a completed Todo overdue', () => {
    const result = mapTodo(
      { ...baseTodo, completedAt: new Date('2026-09-06T12:00:00.000Z') },
      new Date('2026-09-07T00:00:00.000Z'),
    );

    expect(result.completed).toBe(true);
    expect(result.isOverdue).toBe(false);
  });
});
