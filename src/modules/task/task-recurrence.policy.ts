import { TaskStatus } from '../../../generated/prisma/enums.js';

interface RecurrenceOccurrenceState {
  dueAt: Date | null;
  status: TaskStatus;
}

export function shouldMaterializeNextOccurrence(
  occurrencesNewestFirst: RecurrenceOccurrenceState[],
  nextOccurrenceAt: Date,
  now: Date,
): boolean {
  const latest = occurrencesNewestFirst[0];
  const hasOpenFutureOccurrence = occurrencesNewestFirst.some(
    (task) =>
      task.dueAt !== null &&
      task.dueAt > now &&
      task.status !== TaskStatus.COMPLETED &&
      task.status !== TaskStatus.CANCELLED,
  );

  return (
    !hasOpenFutureOccurrence &&
    (nextOccurrenceAt <= now || latest?.status === TaskStatus.COMPLETED)
  );
}
