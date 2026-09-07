import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsInt,
  Max,
  Min,
  ValidateNested,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  TaskCompletionMode,
  TaskPriority,
  TaskRecurrenceFrequency,
} from '../../../../generated/prisma/enums.js';

export class CreateTaskRecurrenceDto {
  @IsEnum(TaskRecurrenceFrequency)
  frequency!: TaskRecurrenceFrequency;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_080)
  reminderLeadMinutes?: number;
}

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  remarks?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueAt?: Date;

  @IsString()
  @MinLength(1)
  teamId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  responsibleUserId?: string;

  @IsOptional()
  @IsEnum(TaskCompletionMode)
  completionMode?: TaskCompletionMode;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateTaskRecurrenceDto)
  recurrence?: CreateTaskRecurrenceDto;
}
