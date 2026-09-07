CREATE TYPE "TodoCategory" AS ENUM (
  'OPERATIONS',
  'SECURITY',
  'FINANCE',
  'TEAM',
  'COMPLIANCE',
  'GENERAL'
);

CREATE TYPE "ApiRateLimitScope" AS ENUM (
  'TODO_CREATE',
  'TODO_DELETE',
  'TODO_CLEAR_COMPLETED'
);

CREATE TABLE "todo_item" (
  "id" TEXT NOT NULL,
  "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ownerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
  "category" "TodoCategory" NOT NULL DEFAULT 'GENERAL',
  "dueOn" DATE,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "todo_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "api_rate_limit_bucket" (
  "id" TEXT NOT NULL,
  "scope" "ApiRateLimitScope" NOT NULL,
  "subjectHash" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "api_rate_limit_bucket_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "api_rate_limit_bucket_count_check" CHECK ("count" > 0)
);

CREATE UNIQUE INDEX "todo_item_public_id_key" ON "todo_item"("public_id");
CREATE INDEX "todo_item_ownerId_completedAt_idx" ON "todo_item"("ownerId", "completedAt");
CREATE INDEX "todo_item_ownerId_dueOn_idx" ON "todo_item"("ownerId", "dueOn");
CREATE INDEX "todo_item_ownerId_priority_idx" ON "todo_item"("ownerId", "priority");
CREATE INDEX "todo_item_ownerId_category_idx" ON "todo_item"("ownerId", "category");

CREATE UNIQUE INDEX "api_rate_limit_bucket_scope_subjectHash_windowStart_key"
  ON "api_rate_limit_bucket"("scope", "subjectHash", "windowStart");
CREATE INDEX "api_rate_limit_bucket_expiresAt_idx"
  ON "api_rate_limit_bucket"("expiresAt");

ALTER TABLE "todo_item"
  ADD CONSTRAINT "todo_item_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
