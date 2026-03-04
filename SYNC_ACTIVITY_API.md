# Activity Sync API Documentation

## Endpoint
```
POST /api/v1/sync/activity
```

## Authentication
- **Required**: Firebase Bearer Token
- **Header**: `Authorization: Bearer <firebase_token>`
- **Content-Type**: `application/json`

---

## Request Payload

### Root Level
```json
{
  "user_id": "64f1a2b3c4d5e6f7g8h9i0j1",
  "sync_timestamp": "2026-03-03T14:30:45",
  "data": [
    {
      "project_name": "zenno-backend",
      "metadata": {
        "first_seen_at": "2026-02-15T10:00:00",
        "last_active_at": "2026-03-03T14:30:45"
      },
      "current_loc": [...],
      "project_skills": [...],
      "days": [...]
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | ✓ | MongoDB user ObjectId |
| `sync_timestamp` | string | ✓ | ISO 8601 local timestamp (e.g., "2026-03-03T14:30:45") |
| `data` | array | ✓ | Array of project sync data |

---

## Project Sync Object

### Structure
```json
{
  "project_name": "zenno-backend",
  "metadata": {
    "first_seen_at": "2026-02-15T10:00:00",
    "last_active_at": "2026-03-03T14:30:45"
  },
  "current_loc": [
    {
      "language": "TypeScript",
      "lines": 1849,
      "files": 23
    }
  ],
  "project_skills": [
    {
      "skill_name": "backend",
      "duration_sec": 5400
    }
  ],
  "days": [...]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `project_name` | string | ✓ | Project identifier/name |
| `metadata` | object | ✓ | Project metadata (timestamps) |
| `current_loc` | array | ✗ | Current state of languages/lines/files |
| `project_skills` | array | ✗ | **NEW**: Cumulative project skills breakdown |
| `days` | array | ✓ | Daily activity buckets |

---

## Metadata Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `first_seen_at` | string | ✗ | ISO 8601 local timestamp (only on new projects) |
| `last_active_at` | string | ✓ | ISO 8601 local timestamp of last activity |

**Example:**
```json
{
  "metadata": {
    "first_seen_at": "2026-02-15T10:00:00",
    "last_active_at": "2026-03-03T14:30:45"
  }
}
```

---

## Current Location Object

Snapshot of current language/file breakdown for the project.

| Field | Type | Description |
|-------|------|-------------|
| `language` | string | Programming language name |
| `lines` | number | Total lines of code in this language |
| `files` | number | Total number of files in this language |

**Example Array:**
```json
"current_loc": [
  {
    "language": "TypeScript",
    "lines": 1849,
    "files": 23
  },
  {
    "language": "Python",
    "lines": 7173,
    "files": 36
  },
  {
    "language": "JSON",
    "lines": 12036,
    "files": 5
  }
]
```

---

## Project Skills Object (NEW)

**Cumulative skills breakdown per project** — tracks total time spent on each skill across the entire project timeline.

| Field | Type | Description |
|-------|------|-------------|
| `skill_name` | string | Skill label (inferred from language, file types, context) |
| `duration_sec` | number | Total cumulative seconds spent on this skill across the project |

**Primary Key:** `(project_name, skill_name)` — One row per skill per project (cumulative, not daily)

**Example Array:**
```json
"project_skills": [
  {
    "skill_name": "backend",
    "duration_sec": 54000
  },
  {
    "skill_name": "database",
    "duration_sec": 18000
  },
  {
    "skill_name": "debugging",
    "duration_sec": 9000
  },
  {
    "skill_name": "documentation",
    "duration_sec": 3600
  }
]
```

---

## Daily Activity Buckets

### Structure
```json
"days": [
  {
    "date": "2026-03-03",
    "languages": {
      "TypeScript": 3600,
      "Python": 1800,
      "JSON": 900
    },
    "apps": {
      "VS Code": 5400,
      "Terminal": 1800
    },
    "context": {
      "focused": 5400,
      "distracted": 1800
    },
    "behavior": {
      "keystrokes": 5432,
      "clicks": 234,
      "scrolls": 89,
      "idle_sec": 1800
    }
  }
]
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string | ✓ | YYYY-MM-DD (local calendar date) |
| `languages` | object | ✗ | Language → duration_sec mapping |
| `apps` | object | ✗ | App name → duration_sec mapping |
| `context` | object | ✗ | Context state → duration_sec mapping |
| `behavior` | object | ✗ | User behavior metrics |

### Behavior Object
| Field | Type | Description |
|-------|------|-------------|
| `keystrokes` | number | Total keystrokes for the day |
| `clicks` | number | Total mouse clicks for the day |
| `scrolls` | number | Total scroll events for the day |
| `idle_sec` | number | Total idle time in seconds for the day |

---

## Complete Example Request

```json
{
  "user_id": "64f1a2b3c4d5e6f7g8h9i0j1",
  "sync_timestamp": "2026-03-03T14:30:45",
  "data": [
    {
      "project_name": "zenno-backend",
      "metadata": {
        "first_seen_at": "2026-02-15T10:00:00",
        "last_active_at": "2026-03-03T14:30:45"
      },
      "current_loc": [
        {
          "language": "TypeScript",
          "lines": 1849,
          "files": 23
        },
        {
          "language": "Python",
          "lines": 7173,
          "files": 36
        }
      ],
      "project_skills": [
        {
          "skill_name": "backend",
          "duration_sec": 54000
        },
        {
          "skill_name": "database",
          "duration_sec": 18000
        },
        {
          "skill_name": "debugging",
          "duration_sec": 9000
        }
      ],
      "days": [
        {
          "date": "2026-03-03",
          "languages": {
            "TypeScript": 3600,
            "Python": 1800
          },
          "apps": {
            "VS Code": 5400,
            "Terminal": 1800
          },
          "context": {
            "focused": 5400,
            "distracted": 1800
          },
          "behavior": {
            "keystrokes": 5432,
            "clicks": 234,
            "scrolls": 89,
            "idle_sec": 1800
          }
        }
      ]
    }
  ]
}
```

---

## Response

### 200 Success
```json
{
  "success": true,
  "message": "Activity synced successfully",
  "sync_timestamp": "2026-03-03T14:30:45",
  "user": {
    "id": "64f1a2b3c4d5e6f7g8h9i0j1",
    "email": "user@example.com",
    "name": "John Doe",
    "profile_photo": "https://...",
    "activity_sync_at": "2026-03-03T14:30:45",
    "stats": {
      "total_activity_records": 42,
      "total_projects": 5
    }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Sync success status |
| `message` | string | Status message |
| `sync_timestamp` | string | Timestamp from request payload |
| `user` | object | Updated user information |
| `user.activity_sync_at` | string | ISO 8601 local timestamp of sync |
| `user.stats` | object | User activity statistics |

---

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Invalid user_id format (must be valid MongoDB ObjectId)"
}
```

**Possible messages:**
- `Invalid sync_timestamp (must be ISO 8601)`
- `user_id does not match authenticated user`
- `Invalid date in days bucket for project {name}: {date}`
- `User not found`

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 500 Server Error
```json
{
  "statusCode": 500,
  "message": "Sync failed: {error_details}"
}
```

---

## Data Handling Notes

### Timestamps
- All timestamps are in **local time** (user's local timezone)
- Format: ISO 8601 without timezone suffix (e.g., `"2026-03-03T14:30:45"`)
- Not UTC — represents user's actual local time when sync occurred

### Date Field
- YYYY-MM-DD format only (local calendar date)
- Used to group daily activity records

### Duration Values
- All durations are in **seconds**
- Backend converts to hours for dashboard display (÷ 3600)

### Skills
- **`project_skills`**: Cumulative across entire project lifetime (sent in payload)
- Skills are tracked at project level only, not daily

### Optional Fields
- `first_seen_at` in metadata: Only send on initial project sync
- `current_loc`: Can be omitted if not updated

---

## Backend Storage

### User Model
- `activity_sync_at`: String (ISO 8601 local timestamp)
- Contains timestamp when this sync API was called

### Activity Model (per day)
- `date`: Date (stored as UTC midnight representing local calendar date)
- `last_synced_at`: String (ISO 8601 local timestamp)
- Other fields: Maps for languages, apps, context, behavior

### Project Model
- `first_seen_at`: String (ISO 8601 local timestamp)
- `last_active_at`: String (ISO 8601 local timestamp)
- `project_skills`: Array of skill objects (cumulative)
- `current_loc`: Current language breakdown

---

## Implementation Checklist

- [ ] Extract and format local timestamp correctly
- [ ] Include all required daily metrics (languages, apps, skills, context, behavior)
- [ ] Calculate cumulative project_skills (sum across all days for the project)
- [ ] Ensure date format is YYYY-MM-DD
- [ ] Validate all timestamp formats (ISO 8601)
- [ ] Send valid MongoDB ObjectId for user_id
- [ ] Handle sync response and update local database
- [ ] Implement retry logic for failed syncs (marked as `needs_sync` = 1 on desktop)
