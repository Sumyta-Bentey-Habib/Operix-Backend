import { HttpStatus } from '@nestjs/common';
import { DateTime } from 'luxon';
import { AppException } from '../../shared/errors/app.exception.js';
import { TODO_ERROR_CODE } from './todo.constant.js';

const TODO_DATE_FORMAT = 'yyyy-LL-dd';
const TODO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseTodoDate(value: string): Date {
  if (!TODO_DATE_PATTERN.test(value)) throw invalidTodoDate();
  const parsed = DateTime.fromFormat(value, TODO_DATE_FORMAT, {
    zone: 'utc',
    locale: 'en',
  });
  if (!parsed.isValid || parsed.toFormat(TODO_DATE_FORMAT) !== value) {
    throw invalidTodoDate();
  }
  return parsed.startOf('day').toJSDate();
}

export function formatTodoDate(value: Date): string {
  return DateTime.fromJSDate(value, { zone: 'utc' }).toFormat(TODO_DATE_FORMAT);
}

export function getCurrentBusinessDate(timezone: string, now: Date): Date {
  const local = DateTime.fromJSDate(now, { zone: 'utc' }).setZone(timezone);
  return DateTime.utc(local.year, local.month, local.day).toJSDate();
}

function invalidTodoDate(): AppException {
  return new AppException(
    HttpStatus.BAD_REQUEST,
    TODO_ERROR_CODE.INVALID_DUE_DATE,
    'Todo due date must be a valid date in YYYY-MM-DD format.',
  );
}
