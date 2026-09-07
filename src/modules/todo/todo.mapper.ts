import type { Prisma } from '../../../generated/prisma/client.js';
import type { TodoResponse } from './todo.interface.js';
import { formatTodoDate } from './todo-date.helper.js';
import { todoSelect } from './todo.select.js';

type SelectedTodo = Prisma.TodoItemGetPayload<{ select: typeof todoSelect }>;

export function mapTodo(todo: SelectedTodo, businessToday: Date): TodoResponse {
  return {
    id: todo.publicId,
    title: todo.title,
    description: todo.description,
    priority: todo.priority,
    category: todo.category,
    dueDate: todo.dueOn ? formatTodoDate(todo.dueOn) : null,
    tags: todo.tags,
    completed: todo.completedAt !== null,
    completedAt: todo.completedAt?.toISOString() ?? null,
    isOverdue:
      todo.completedAt === null &&
      todo.dueOn !== null &&
      todo.dueOn.getTime() < businessToday.getTime(),
    createdAt: todo.createdAt.toISOString(),
    updatedAt: todo.updatedAt.toISOString(),
  };
}
