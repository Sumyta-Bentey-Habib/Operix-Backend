import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  TaskPriority,
  TodoCategory,
} from '../../../../generated/prisma/enums.js';
import { PaginationQueryDto } from '../../../shared/pagination/pagination.dto.js';
import {
  TODO_VALIDATION,
  TodoSort,
  TodoStatusFilter,
} from '../todo.constant.js';

export class ListTodoQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(TodoStatusFilter)
  status?: TodoStatusFilter;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  category?: TodoCategory;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  overdue?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(TODO_VALIDATION.SEARCH_MAX_LENGTH)
  q?: string;

  @IsOptional()
  @IsEnum(TodoSort)
  sort?: TodoSort;
}
