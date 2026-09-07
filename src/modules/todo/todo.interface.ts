import type {
  TaskPriority,
  TodoCategory,
} from '../../../generated/prisma/enums.js';
import type { PaginationMeta } from '../../shared/pagination/pagination.interface.js';

export interface TodoResponse {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  category: TodoCategory;
  dueDate: string | null;
  tags: string[];
  completed: boolean;
  completedAt: string | null;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedTodoResponse {
  data: TodoResponse[];
  meta: PaginationMeta;
}

export interface TodoSummaryResponse {
  total: number;
  active: number;
  completed: number;
  urgent: number;
  overdue: number;
  completionRate: number;
}
