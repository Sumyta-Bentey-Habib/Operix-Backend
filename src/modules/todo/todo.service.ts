import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../../../generated/prisma/client.js';
import { TaskPriority, TodoCategory } from '../../../generated/prisma/enums.js';
import type { ApplicationConfiguration } from '../../config/configuration.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { OperixViewer } from '../../shared/auth/viewer.interface.js';
import { AppException } from '../../shared/errors/app.exception.js';
import {
  createPaginationMeta,
  normalizePagination,
} from '../../shared/pagination/pagination.helper.js';
import type { CreateTodoDto } from './dto/create-todo.dto.js';
import type { ListTodoQueryDto } from './dto/list-todo-query.dto.js';
import type { UpdateTodoDto } from './dto/update-todo.dto.js';
import {
  TODO_ERROR_CODE,
  TODO_VALIDATION,
  TodoSort,
  TodoStatusFilter,
} from './todo.constant.js';
import { getCurrentBusinessDate, parseTodoDate } from './todo-date.helper.js';
import type {
  PaginatedTodoResponse,
  TodoResponse,
  TodoSummaryResponse,
} from './todo.interface.js';
import { mapTodo } from './todo.mapper.js';
import { todoSelect } from './todo.select.js';

@Injectable()
export class TodoService {
  private readonly timezone: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<ApplicationConfiguration, true>,
  ) {
    this.timezone = config.get('app.businessTimezone', { infer: true });
  }

  async create(
    viewer: OperixViewer,
    dto: CreateTodoDto,
  ): Promise<TodoResponse> {
    const businessToday = this.businessToday();
    const todo = await this.prisma.todoItem.create({
      data: {
        ownerId: viewer.userId,
        title: normalizeTitle(dto.title),
        description: normalizeDescription(dto.description),
        priority: dto.priority ?? TaskPriority.MEDIUM,
        category: normalizeCategory(dto.category),
        dueOn: normalizeDueDate(dto.dueDate),
        tags: normalizeTags(dto.tags),
      },
      select: todoSelect,
    });
    return mapTodo(todo, businessToday);
  }

  async list(
    viewer: OperixViewer,
    query: ListTodoQueryDto,
  ): Promise<PaginatedTodoResponse> {
    const businessToday = this.businessToday();
    const pagination = normalizePagination(query);
    const where = buildTodoWhere(viewer.userId, query, businessToday);
    const [todos, total] = await Promise.all([
      this.prisma.todoItem.findMany({
        where,
        select: todoSelect,
        orderBy: buildTodoOrderBy(query.sort),
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.todoItem.count({ where }),
    ]);
    return {
      data: todos.map((todo) => mapTodo(todo, businessToday)),
      meta: createPaginationMeta({
        page: pagination.page,
        limit: pagination.limit,
        total,
      }),
    };
  }

  async summary(viewer: OperixViewer): Promise<TodoSummaryResponse> {
    const businessToday = this.businessToday();
    const owner = { ownerId: viewer.userId };
    const [total, active, completed, urgent, overdue] = await Promise.all([
      this.prisma.todoItem.count({ where: owner }),
      this.prisma.todoItem.count({
        where: { ...owner, completedAt: null },
      }),
      this.prisma.todoItem.count({
        where: { ...owner, completedAt: { not: null } },
      }),
      this.prisma.todoItem.count({
        where: {
          ...owner,
          completedAt: null,
          priority: { in: [TaskPriority.HIGH, TaskPriority.URGENT] },
        },
      }),
      this.prisma.todoItem.count({
        where: {
          ...owner,
          completedAt: null,
          dueOn: { not: null, lt: businessToday },
        },
      }),
    ]);
    return {
      total,
      active,
      completed,
      urgent,
      overdue,
      completionRate: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  }

  async get(viewer: OperixViewer, todoId: string): Promise<TodoResponse> {
    const businessToday = this.businessToday();
    const todo = await this.findOwned(viewer.userId, todoId);
    return mapTodo(todo, businessToday);
  }

  async update(
    viewer: OperixViewer,
    todoId: string,
    dto: UpdateTodoDto,
  ): Promise<TodoResponse> {
    const businessToday = this.businessToday();
    const existing = await this.findOwned(viewer.userId, todoId);
    const data: Prisma.TodoItemUpdateInput = {};

    if (dto.title !== undefined) data.title = normalizeTitle(dto.title);
    if (dto.description !== undefined)
      data.description = normalizeDescription(dto.description);
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.category !== undefined)
      data.category = normalizeCategory(dto.category);
    if (dto.dueDate !== undefined) data.dueOn = normalizeDueDate(dto.dueDate);
    if (dto.tags !== undefined) data.tags = normalizeTags(dto.tags);

    if (Object.keys(data).length === 0) return mapTodo(existing, businessToday);
    const updated = await this.prisma.todoItem.update({
      where: { id: existing.id },
      data,
      select: todoSelect,
    });
    return mapTodo(updated, businessToday);
  }

  async complete(viewer: OperixViewer, todoId: string): Promise<TodoResponse> {
    const businessToday = this.businessToday();
    const existing = await this.findOwned(viewer.userId, todoId);
    if (existing.completedAt === null) {
      await this.prisma.todoItem.updateMany({
        where: {
          id: existing.id,
          ownerId: viewer.userId,
          completedAt: null,
        },
        data: { completedAt: new Date() },
      });
    }
    return mapTodo(await this.findOwned(viewer.userId, todoId), businessToday);
  }

  async reopen(viewer: OperixViewer, todoId: string): Promise<TodoResponse> {
    const businessToday = this.businessToday();
    const existing = await this.findOwned(viewer.userId, todoId);
    if (existing.completedAt !== null) {
      await this.prisma.todoItem.updateMany({
        where: {
          id: existing.id,
          ownerId: viewer.userId,
          completedAt: { not: null },
        },
        data: { completedAt: null },
      });
    }
    return mapTodo(await this.findOwned(viewer.userId, todoId), businessToday);
  }

  async delete(viewer: OperixViewer, todoId: string): Promise<{ id: string }> {
    const deleted = await this.prisma.todoItem.deleteMany({
      where: { publicId: todoId, ownerId: viewer.userId },
    });
    if (deleted.count === 0) throw todoNotFound();
    return { id: todoId };
  }

  async clearCompleted(viewer: OperixViewer): Promise<{ deleted: number }> {
    const result = await this.prisma.todoItem.deleteMany({
      where: { ownerId: viewer.userId, completedAt: { not: null } },
    });
    return { deleted: result.count };
  }

  private businessToday(now = new Date()): Date {
    return getCurrentBusinessDate(this.timezone, now);
  }

  private async findOwned(userId: string, todoId: string) {
    const todo = await this.prisma.todoItem.findFirst({
      where: { publicId: todoId, ownerId: userId },
      select: todoSelect,
    });
    if (!todo) throw todoNotFound();
    return todo;
  }
}

function buildTodoWhere(
  ownerId: string,
  query: ListTodoQueryDto,
  businessToday: Date,
): Prisma.TodoItemWhereInput {
  const where: Prisma.TodoItemWhereInput = { ownerId };
  const additionalConditions: Prisma.TodoItemWhereInput[] = [];

  if (query.status === TodoStatusFilter.ACTIVE) where.completedAt = null;
  if (query.status === TodoStatusFilter.COMPLETED)
    where.completedAt = { not: null };
  if (query.priority) where.priority = query.priority;
  if (query.category) where.category = normalizeCategory(query.category);

  if (query.overdue === true) {
    additionalConditions.push({
      completedAt: null,
      dueOn: { not: null, lt: businessToday },
    });
  } else if (query.overdue === false) {
    where.OR = [
      { completedAt: { not: null } },
      { dueOn: null },
      { dueOn: { gte: businessToday } },
    ];
  }

  const q = query.q?.trim();
  if (q) {
    additionalConditions.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { tags: { has: q.toLowerCase() } },
      ],
    });
  }
  if (additionalConditions.length > 0) where.AND = additionalConditions;
  return where;
}

function buildTodoOrderBy(
  sort = TodoSort.CREATED_AT_DESC,
): Prisma.TodoItemOrderByWithRelationInput[] {
  switch (sort) {
    case TodoSort.CREATED_AT_ASC:
      return [{ createdAt: 'asc' }, { id: 'asc' }];
    case TodoSort.DUE_ON_ASC:
      return [
        { dueOn: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
        { id: 'desc' },
      ];
    case TodoSort.DUE_ON_DESC:
      return [
        { dueOn: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
        { id: 'desc' },
      ];
    case TodoSort.PRIORITY_ASC:
      return [{ priority: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }];
    case TodoSort.PRIORITY_DESC:
      return [{ priority: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }];
    case TodoSort.TITLE_ASC:
      return [{ title: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }];
    case TodoSort.TITLE_DESC:
      return [{ title: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }];
    case TodoSort.CREATED_AT_DESC:
    default:
      return [{ createdAt: 'desc' }, { id: 'desc' }];
  }
}

function normalizeTitle(value: string): string {
  const title = value.trim();
  if (title.length === 0 || title.length > TODO_VALIDATION.TITLE_MAX_LENGTH) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      TODO_ERROR_CODE.TITLE_REQUIRED,
      'Todo title must contain between 1 and 180 characters.',
    );
  }
  return title;
}

function normalizeDescription(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const description = value.trim();
  if (description.length === 0) return null;
  if (description.length > TODO_VALIDATION.DESCRIPTION_MAX_LENGTH) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_ERROR',
      'Todo description must not exceed 2000 characters.',
    );
  }
  return description;
}

function normalizeCategory(value: TodoCategory | undefined): TodoCategory {
  const category = value ?? TodoCategory.GENERAL;
  if (!Object.values(TodoCategory).includes(category)) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      TODO_ERROR_CODE.INVALID_CATEGORY,
      'Todo category is invalid.',
    );
  }
  return category;
}

function normalizeDueDate(value: string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  return parseTodoDate(value);
}

function normalizeTags(values: string[] | undefined): string[] {
  if (!values) return [];
  const tags = [
    ...new Set(values.map((tag) => tag.trim().toLowerCase())),
  ].filter((tag) => tag.length > 0);
  if (tags.length > TODO_VALIDATION.TAG_MAX_COUNT) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      TODO_ERROR_CODE.TOO_MANY_TAGS,
      'A Todo may have at most 10 tags.',
    );
  }
  if (tags.some((tag) => tag.length > TODO_VALIDATION.TAG_MAX_LENGTH)) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      TODO_ERROR_CODE.INVALID_TAG,
      'Todo tags must not exceed 32 characters.',
    );
  }
  return tags;
}

function todoNotFound(): AppException {
  return new AppException(
    HttpStatus.NOT_FOUND,
    TODO_ERROR_CODE.NOT_FOUND,
    'Todo not found.',
  );
}
