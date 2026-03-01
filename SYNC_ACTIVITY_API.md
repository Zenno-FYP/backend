# Sync Activity API (Desktop Agent → Backend)

## Endpoint

`POST /sync/activity`

## Authentication

- Header: `Authorization: Bearer <Firebase ID Token>`
- Backend verifies the ID token and uses the authenticated user email.

## Purpose

Offline-first **batch sync**.

You send **one request** containing:
- multiple projects
- each project contains **day buckets** (aggregated metrics per day)
- optional project metadata + optional LOC snapshots

The backend stores:
- `projects` collection: one doc per user + project
- `activities` collection: one doc per user + project + date (bucket document)

## Request Body

```json
{
  "user_id": "507f1f77bcf86cd799439011",
  "sync_timestamp": "2026-03-01T14:30:00.123Z",
  "data": [
    {
      "project_name": "desktop-agent",
      "metadata": {
        "first_seen_at": "2026-02-27T09:00:00Z",
        "last_active_at": "2026-03-01T14:25:00Z"
      },
      "current_loc": [
        { "language": "python", "lines": 4500, "files": 12 },
        { "language": "sql", "lines": 150, "files": 1 }
      ],
      "days": [
        {
          "date": "2026-02-27",
          "languages": { "python": 1200, "sql": 300 },
          "apps": { "vscode": 1400, "chrome": 100 },
          "skills": { "backend": 1000, "debugging": 500 },
          "context": { "focused": 1200, "reading": 300 },
          "behavior": {
            "keystrokes": 5000,
            "clicks": 120,
            "scrolls": 50,
            "idle_sec": 100
          }
        },
        {
          "date": "2026-03-01",
          "languages": { "python": 3600 },
          "apps": { "vscode": 3500, "terminal": 100 },
          "skills": { "refactoring": 3600 },
          "context": { "focused": 3600 },
          "behavior": {
            "keystrokes": 12000,
            "clicks": 400,
            "scrolls": 150,
            "idle_sec": 45
          }
        }
      ]
    },
    {
      "project_name": "zenno-web",
      "metadata": {
        "last_active_at": "2026-03-01T10:00:00Z"
      },
      "current_loc": [
        { "language": "javascript", "lines": 8000, "files": 20 },
        { "language": "css", "lines": 2000, "files": 5 },
        { "language": "html", "lines": 1500, "files": 5 }
      ],
      "days": [
        {
          "date": "2026-03-01",
          "languages": { "javascript": 1800, "css": 600 },
          "apps": { "vscode": 2400 },
          "skills": { "frontend": 2400 },
          "context": { "focused": 2000, "distracted": 400 },
          "behavior": {
            "keystrokes": 3000,
            "clicks": 800,
            "scrolls": 600,
            "idle_sec": 20
          }
        }
      ]
    }
  ]
}
```

## Request Fields Explained

### Top Level
- `user_id`: MongoDB ObjectId of the authenticated user (string format)
- `sync_timestamp`: ISO 8601 timestamp when the sync occurs (stored as `last_synced_at` in each daily activity bucket)

### Project Object
- `project_name`: Unique identifier for the project (e.g., "zenno-web", "desktop-agent")
- `metadata`: (Optional) Project metadata containing:
  - `first_seen_at`: ISO 8601 timestamp (required **only on first sync** for new projects; omit for existing projects)
  - `last_active_at`: ISO 8601 timestamp of most recent activity in this sync batch
- `current_loc`: (Optional) Array of current lines-of-code snapshots per language
- `days[]`: (Required) Array of daily activity buckets

### Day Bucket
- `date`: YYYY-MM-DD format; backend normalizes to start-of-day UTC
- `languages`, `apps`, `skills`, `context`: Maps with `{ "name": duration_in_seconds }`
- `behavior`: Object with `keystrokes`, `clicks`, `scrolls`, `idle_sec` counts

## Project Sync Logic

### NEW PROJECT (First Sync)
When a project is synced **for the first time**:
1. Include `metadata.first_seen_at` in the request
2. Backend creates a new `projects` document with:
   - `user_id`, `project_name` (unique compound index)
   - `first_seen_at` = value from metadata
   - `last_active_at` = value from metadata
   - `languages` map with LOC snapshots from `current_loc[]`
3. Creates daily activity documents for each day in `days[]`

**Example:**
```json
{
  "project_name": "desktop-agent",
  "metadata": {
    "first_seen_at": "2026-02-27T09:00:00Z",
    "last_active_at": "2026-03-01T14:25:00Z"
  },
  "current_loc": [
    { "language": "python", "lines": 4500, "files": 12 }
  ],
  "days": [...]
}
```

### EXISTING PROJECT (Update Only)
When syncing a project that **already exists**:
1. **Omit** `metadata.first_seen_at` (backend ignores it)
2. Include only `metadata.last_active_at` to update the project's last activity
3. Backend updates the project document:
   - `first_seen_at` remains unchanged
   - `last_active_at` is updated to the new value
   - `languages` map is merged with new LOC snapshots from `current_loc[]`
4. Updates or creates daily activity documents for each day in `days[]`

**Example:**
```json
{
  "project_name": "zenno-web",
  "metadata": {
    "last_active_at": "2026-03-01T10:00:00Z"
  },
  "current_loc": [
    { "language": "javascript", "lines": 8000, "files": 20 }
  ],
  "days": [...]
}
```

## Daily Activity Handling (Idempotent Upsert)

For each day in the `days[]` array:
1. Backend looks up activity by `(user_id, project_name, date)` unique compound index
2. If **day exists**: Merges new metrics into existing document (overwrites duration values)
3. If **day doesn't exist**: Creates new daily activity document
4. Sets `last_synced_at = sync_timestamp` on each update

**Safe to resync**: You can safely send the same batch twice; metrics will be updated but not duplicated.

## Response (201)

```json
{
  "success": true,
  "message": "Activity synced successfully",
  "sync_timestamp": "2026-02-28T16:01:12.000Z",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "profile_photo": "https://...",
    "activity_sync_at": "2026-02-28T16:01:12.000Z",
    "stats": {
      "total_activity_records": 45,
      "total_projects": 5
    }
  }
}
```

## Storage Model (MongoDB)

### `projects` collection

One document per project per user.
- Updated via idempotent upsert using `(user_id, project_name)` unique index.
- LOC snapshots are stored under `languages.<language_name>`.

### `activities` collection

One document per **project per day per user**.
- Updated via idempotent upsert using `(user_id, project_name, date)` unique index.
- Daily buckets store `languages`, `apps`, `skills`, `context_states`, `behavior`, and `last_synced_at`.

## Recommended Client Sync Strategy

- Build your daily aggregates locally from SQLite tables where `needs_sync = 1`.
- Batch multiple projects + multiple days into **one** request.
- On HTTP `401`, refresh Firebase ID token on client and retry.
