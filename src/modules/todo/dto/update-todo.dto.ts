import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import {
  TaskPriority,
  TodoCategory,
} from '../../../../generated/prisma/enums.js';

export class UpdateTodoDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  category?: TodoCategory;

  @IsOptional()
  @IsString()
  dueDate?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
