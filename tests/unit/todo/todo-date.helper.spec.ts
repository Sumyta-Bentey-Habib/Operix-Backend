import {
  formatTodoDate,
  getCurrentBusinessDate,
  parseTodoDate,
} from '../../../src/modules/todo/todo-date.helper';

describe('Todo date helpers', () => {
  it('round trips a calendar date without timezone shifting it', () => {
    const parsed = parseTodoDate('2026-09-07');

    expect(formatTodoDate(parsed)).toBe('2026-09-07');
    expect(parsed.toISOString()).toBe('2026-09-07T00:00:00.000Z');
  });

  it('rejects malformed and impossible calendar dates', () => {
    expect(() => parseTodoDate('2026-9-07')).toThrow(
      'Todo due date must be a valid date',
    );
    expect(() => parseTodoDate('2026-02-30')).toThrow(
      'Todo due date must be a valid date',
    );
  });

  it('uses the Dhaka calendar date at the UTC day boundary', () => {
    const today = getCurrentBusinessDate(
      'Asia/Dhaka',
      new Date('2026-09-06T18:30:00.000Z'),
    );

    expect(formatTodoDate(today)).toBe('2026-09-07');
  });
});
