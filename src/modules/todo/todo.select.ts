import { Prisma } from '../../../generated/prisma/client.js';

export const todoSelect = {
  id: true,
  publicId: true,
  title: true,
  description: true,
  priority: true,
  category: true,
  dueOn: true,
  tags: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TodoItemSelect;
