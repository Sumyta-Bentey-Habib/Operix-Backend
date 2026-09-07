import { randomBytes } from 'node:crypto';

export function generateTaskReferenceCode(now = new Date()): string {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = randomBytes(3).toString('hex').toUpperCase();

  return `TASK-${date}-${suffix}`;
}
