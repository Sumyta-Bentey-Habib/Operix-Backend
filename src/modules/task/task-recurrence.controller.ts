import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '../../../generated/prisma/enums.js';
import { AccountStatusGuard } from '../../shared/auth/account-status.guard.js';
import { CurrentViewer } from '../../shared/auth/current-viewer.decorator.js';
import { OperixRoleGuard } from '../../shared/auth/operix-role.guard.js';
import { RequireRoles } from '../../shared/auth/require-roles.decorator.js';
import { ViewerContextGuard } from '../../shared/auth/viewer-context.guard.js';
import type { OperixViewer } from '../../shared/auth/viewer.interface.js';
import { PublicIdPipe } from '../../shared/identity/public-id.pipe.js';
import { UpdateTaskRecurrenceDto } from './dto/update-task-recurrence.dto.js';
import { TaskRecurrenceService } from './task-recurrence.service.js';

@ApiTags('task-recurrences')
@Controller('task-recurrences')
@UseGuards(ViewerContextGuard, AccountStatusGuard, OperixRoleGuard)
@RequireRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MEMBER)
export class TaskRecurrenceController {
  constructor(private readonly service: TaskRecurrenceService) {}

  @Get(':recurrenceId')
  get(
    @CurrentViewer() viewer: OperixViewer,
    @Param('recurrenceId', PublicIdPipe) recurrenceId: string,
  ) {
    return this.service.getRecurrence(viewer, recurrenceId);
  }

  @Get(':recurrenceId/occurrences')
  occurrences(
    @CurrentViewer() viewer: OperixViewer,
    @Param('recurrenceId', PublicIdPipe) recurrenceId: string,
  ) {
    return this.service.listOccurrences(viewer, recurrenceId);
  }

  @Patch(':recurrenceId')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  update(
    @CurrentViewer() viewer: OperixViewer,
    @Param('recurrenceId', PublicIdPipe) recurrenceId: string,
    @Body() dto: UpdateTaskRecurrenceDto,
  ) {
    return this.service.updateRecurrence(viewer, recurrenceId, dto);
  }
}
