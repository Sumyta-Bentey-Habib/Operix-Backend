-- Task execution modes and recurrence state.
CREATE TYPE "TaskCompletionMode" AS ENUM ('REVIEW_REQUIRED', 'DIRECT');
CREATE TYPE "TaskRecurrenceFrequency" AS ENUM ('WEEKLY', 'MONTHLY');
CREATE TYPE "TaskReminderStatus" AS ENUM ('PENDING', 'SENT', 'CANCELLED');
CREATE TYPE "TaskRecurrenceBlockedReason" AS ENUM (
  'RESPONSIBLE_NOT_FOUND',
  'RESPONSIBLE_NOT_ACTIVE',
  'TEAM_NOT_AVAILABLE',
  'INVALID_SERIES_CONFIGURATION'
);

-- Generalize Task assignment from Member-only to any eligible responsible User.
ALTER TABLE "task_assignment" RENAME COLUMN "memberId" TO "responsibleUserId";
ALTER INDEX "task_assignment_memberId_idx" RENAME TO "task_assignment_responsibleUserId_idx";
ALTER TABLE "task_assignment"
  RENAME CONSTRAINT "task_assignment_memberId_fkey"
  TO "task_assignment_responsibleUserId_fkey";

-- Existing Tasks retain the reviewed workflow through the default.
ALTER TABLE "task"
  ADD COLUMN "completionMode" "TaskCompletionMode" NOT NULL DEFAULT 'REVIEW_REQUIRED',
  ADD COLUMN "completionNote" TEXT,
  ADD COLUMN "scheduledStartAt" TIMESTAMP(3),
  ADD COLUMN "recurrenceId" TEXT,
  ADD COLUMN "occurrenceKey" TEXT;

CREATE TABLE "task_recurrence" (
  "id" TEXT NOT NULL,
  "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "frequency" "TaskRecurrenceFrequency" NOT NULL,
  "createdById" TEXT NOT NULL,
  "defaultResponsibleUserId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "categoryId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "remarks" TEXT,
  "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
  "anchorDueAt" TIMESTAMP(3) NOT NULL,
  "anchorLocalDay" INTEGER,
  "anchorLocalWeekday" INTEGER,
  "anchorLocalTime" TEXT NOT NULL,
  "nextOccurrenceAt" TIMESTAMP(3) NOT NULL,
  "reminderLeadMinutes" INTEGER NOT NULL DEFAULT 1440,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastBlockedOccurrenceKey" TEXT,
  "lastBlockedReason" "TaskRecurrenceBlockedReason",
  "lastBlockedNotifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "task_recurrence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "task_recurrence_reminder_lead_check"
    CHECK ("reminderLeadMinutes" BETWEEN 0 AND 10080),
  CONSTRAINT "task_recurrence_anchor_check"
    CHECK (
      ("frequency" = 'WEEKLY' AND "anchorLocalWeekday" BETWEEN 1 AND 7 AND "anchorLocalDay" IS NULL)
      OR
      ("frequency" = 'MONTHLY' AND "anchorLocalDay" BETWEEN 1 AND 31 AND "anchorLocalWeekday" IS NULL)
    )
);

CREATE TABLE "task_reminder" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "status" "TaskReminderStatus" NOT NULL DEFAULT 'PENDING',
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "task_reminder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_recurrence_public_id_key" ON "task_recurrence"("public_id");
CREATE INDEX "task_recurrence_isActive_nextOccurrenceAt_idx" ON "task_recurrence"("isActive", "nextOccurrenceAt");
CREATE INDEX "task_recurrence_createdById_idx" ON "task_recurrence"("createdById");
CREATE INDEX "task_recurrence_defaultResponsibleUserId_idx" ON "task_recurrence"("defaultResponsibleUserId");
CREATE INDEX "task_recurrence_teamId_idx" ON "task_recurrence"("teamId");
CREATE UNIQUE INDEX "task_recurrence_occurrence_key" ON "task"("recurrenceId", "occurrenceKey");
CREATE UNIQUE INDEX "task_reminder_taskId_key" ON "task_reminder"("taskId");
CREATE INDEX "task_reminder_status_scheduledAt_idx" ON "task_reminder"("status", "scheduledAt");

ALTER TABLE "task_recurrence"
  ADD CONSTRAINT "task_recurrence_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_recurrence"
  ADD CONSTRAINT "task_recurrence_defaultResponsibleUserId_fkey"
  FOREIGN KEY ("defaultResponsibleUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_recurrence"
  ADD CONSTRAINT "task_recurrence_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_recurrence"
  ADD CONSTRAINT "task_recurrence_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "task_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "task"
  ADD CONSTRAINT "task_recurrenceId_fkey"
  FOREIGN KEY ("recurrenceId") REFERENCES "task_recurrence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_reminder"
  ADD CONSTRAINT "task_reminder_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
