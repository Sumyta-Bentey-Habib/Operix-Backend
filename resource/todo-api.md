# Operix Todo API

Base path: `/api/v1`. All endpoints require an authenticated, active `SUPER_ADMIN` or `ADMIN`. A `MEMBER` receives `403 FORBIDDEN`.

Todo identity is a UUID-v4 in the `id` field and `:todoId` route parameter. A malformed UUID returns `400 VALIDATION_ERROR`; a missing or foreign-owned UUID returns `404 TODO_NOT_FOUND`.

## Response

```json
{
  "id": "7f90b419-ce32-43db-a7d8-7ebc9ca09dc3",
  "title": "Review audit checklist",
  "description": null,
  "priority": "HIGH",
  "category": "COMPLIANCE",
  "dueDate": "2026-09-10",
  "tags": ["audit", "q3"],
  "completed": false,
  "completedAt": null,
  "isOverdue": false,
  "createdAt": "2026-09-07T10:00:00.000Z",
  "updatedAt": "2026-09-07T10:00:00.000Z"
}
```

Owner identity and private database fields are never returned.

## Endpoints

### `POST /todos`

```json
{
  "title": "Review audit checklist",
  "description": "Prepare the compliance notes",
  "priority": "HIGH",
  "category": "COMPLIANCE",
  "dueDate": "2026-09-10",
  "tags": ["Audit", "Q3"]
}
```

Defaults are `MEDIUM`, `GENERAL`, no due date, and no tags. Tags are trimmed, lowercased, deduplicated, limited to 10, and limited to 32 characters each.

### `GET /todos`

Query fields: `page`, `limit`, `status`, `priority`, `category`, `overdue`, `q`, and `sort`.

`status` is `ACTIVE` or `COMPLETED`. Search uses case-insensitive title/description containment and exact normalized tag matching. Sort values are `CREATED_AT_ASC`, `CREATED_AT_DESC`, `DUE_ON_ASC`, `DUE_ON_DESC`, `PRIORITY_ASC`, `PRIORITY_DESC`, `TITLE_ASC`, and `TITLE_DESC`. Due-date sorts place null values last.

### `GET /todos/summary`

```json
{
  "total": 8,
  "active": 5,
  "completed": 3,
  "urgent": 2,
  "overdue": 1,
  "completionRate": 38
}
```

Urgent means an active `HIGH` or `URGENT` Todo. Summary always covers the viewer's full collection.

### Item actions

```text
GET    /todos/:todoId
PATCH  /todos/:todoId
POST   /todos/:todoId/complete
POST   /todos/:todoId/reopen
DELETE /todos/:todoId
```

PATCH supports `title`, nullable `description`, `priority`, `category`, nullable `dueDate`, and replacement `tags`. Complete and reopen are idempotent. `completedAt` is server-owned.

### `DELETE /todos/completed`

Deletes only completed Todos owned by the current viewer and returns `{ "deleted": number }`.

## Rate Limits

Todo create, item delete, and clear-completed use both local and distributed limits. Other mutations use local limits. A rejection uses:

```json
{
  "success": false,
  "message": "Too many requests.",
  "code": "RATE_LIMITED",
  "details": { "retryAfter": 42 }
}
```

The response also contains `Retry-After: 42`.
