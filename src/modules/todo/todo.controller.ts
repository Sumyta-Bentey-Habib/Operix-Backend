import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ApiRateLimitScope,
  UserRole,
} from '../../../generated/prisma/enums.js';
import { AccountStatusGuard } from '../../shared/auth/account-status.guard.js';
import { CurrentViewer } from '../../shared/auth/current-viewer.decorator.js';
import { OperixRoleGuard } from '../../shared/auth/operix-role.guard.js';
import { RequireRoles } from '../../shared/auth/require-roles.decorator.js';
import { ViewerContextGuard } from '../../shared/auth/viewer-context.guard.js';
import type { OperixViewer } from '../../shared/auth/viewer.interface.js';
import { PublicIdPipe } from '../../shared/identity/public-id.pipe.js';
import { DistributedRateLimit } from '../../shared/rate-limit/rate-limit.decorator.js';
import { CreateTodoDto } from './dto/create-todo.dto.js';
import { ListTodoQueryDto } from './dto/list-todo-query.dto.js';
import { UpdateTodoDto } from './dto/update-todo.dto.js';
import { TodoService } from './todo.service.js';

@ApiTags('todos')
@Controller('todos')
@UseGuards(ViewerContextGuard, AccountStatusGuard, OperixRoleGuard)
@RequireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class TodoController {
  constructor(private readonly service: TodoService) {}

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @DistributedRateLimit(ApiRateLimitScope.TODO_CREATE)
  create(@CurrentViewer() viewer: OperixViewer, @Body() dto: CreateTodoDto) {
    return this.service.create(viewer, dto);
  }

  @Get()
  list(
    @CurrentViewer() viewer: OperixViewer,
    @Query() query: ListTodoQueryDto,
  ) {
    return this.service.list(viewer, query);
  }

  @Get('summary')
  summary(@CurrentViewer() viewer: OperixViewer) {
    return this.service.summary(viewer);
  }

  @Delete('completed')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @DistributedRateLimit(ApiRateLimitScope.TODO_CLEAR_COMPLETED)
  clearCompleted(@CurrentViewer() viewer: OperixViewer) {
    return this.service.clearCompleted(viewer);
  }

  @Get(':todoId')
  get(
    @CurrentViewer() viewer: OperixViewer,
    @Param('todoId', PublicIdPipe) todoId: string,
  ) {
    return this.service.get(viewer, todoId);
  }

  @Patch(':todoId')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  update(
    @CurrentViewer() viewer: OperixViewer,
    @Param('todoId', PublicIdPipe) todoId: string,
    @Body() dto: UpdateTodoDto,
  ) {
    return this.service.update(viewer, todoId, dto);
  }

  @Post(':todoId/complete')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  complete(
    @CurrentViewer() viewer: OperixViewer,
    @Param('todoId', PublicIdPipe) todoId: string,
  ) {
    return this.service.complete(viewer, todoId);
  }

  @Post(':todoId/reopen')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  reopen(
    @CurrentViewer() viewer: OperixViewer,
    @Param('todoId', PublicIdPipe) todoId: string,
  ) {
    return this.service.reopen(viewer, todoId);
  }

  @Delete(':todoId')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @DistributedRateLimit(ApiRateLimitScope.TODO_DELETE)
  delete(
    @CurrentViewer() viewer: OperixViewer,
    @Param('todoId', PublicIdPipe) todoId: string,
  ) {
    return this.service.delete(viewer, todoId);
  }
}
