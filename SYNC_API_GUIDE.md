# Desktop Agent Activity Sync API Guide

## Overview

The sync API allows your desktop agent to upload activity metrics to the backend in a **single atomic transaction**. All data is validated, unified with user context, and stored in MongoDB.

---

## API Endpoint

### POST /api/v1/sync/activity

**Authentication:** Bearer Token (Firebase ID Token)

**Purpose:** Sync all daily activity aggregates (languages, apps, skills, context, behavior, LOC snapshots) in one request.

---

## Request/Response Format

### Request Body

```json
{
  "user_id": "firebase_uid_or_email",
  "sync_token": "optional_last_sync_timestamp",
  "data": {
    "daily_languages": [
      {
        "language_name": "typescript",
        "project_name": "zenno-web",
        "date": "2026-02-28",
        "duration_sec": 3600
      },
      {
        "language_name": "python",
        "project_name": "desktop-agent",
        "date": "2026-02-28",
        "duration_sec": 1800
      }
    ],
    "daily_apps": [
      {
        "app_name": "Visual Studio Code",
        "project_name": "zenno-web",
        "date": "2026-02-28",
        "duration_sec": 5400
      },
      {
        "app_name": "Chrome",
        "project_name": "zenno-web",
        "date": "2026-02-28",
        "duration_sec": 1200
      }
    ],
    "daily_skills": [
      {
        "skill_name": "coding",
        "project_name": "zenno-web",
        "date": "2026-02-28",
        "duration_sec": 4000
      },
      {
        "skill_name": "debugging",
        "project_name": "zenno-web",
        "date": "2026-02-28",
        "duration_sec": 1400
      }
    ],
    "daily_context": [
      {
        "context_state": "coding",
        "project_name": "zenno-web",
        "date": "2026-02-28",
        "duration_sec": 5000
      },
      {
        "context_state": "break",
        "project_name": "zenno-web",
        "date": "2026-02-28",
        "duration_sec": 400
      }
    ],
    "daily_behavior": [
      {
        "project_name": "zenno-web",
        "date": "2026-02-28",
        "total_keystrokes": 12000,
        "total_mouse_clicks": 500,
        "total_scroll_events": 300,
        "total_idle_sec": 900
      }
    ],
    "loc_snapshots": [
      {
        "project_name": "zenno-web",
        "language_name": "typescript",
        "lines_of_code": 15000,
        "file_count": 120,
        "last_scanned_at": "2026-02-28T14:05:15.123456"
      },
      {
        "project_name": "zenno-web",
        "language_name": "javascript",
        "lines_of_code": 5000,
        "file_count": 45,
        "last_scanned_at": "2026-02-28T14:05:15.123456"
      }
    ]
  }
}
```

### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Activity synced successfully",
  "sync_timestamp": "2026-02-28T15:30:00.000Z",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "profile_photo": "https://...",
    "stats": {
      "total_activity_records": 45,
      "total_projects": 5
    }
  }
}
```

### Error Response (400 Bad Request)

```json
{
  "success": false,
  "error": "Sync failed: User not found",
  "statusCode": 400,
  "timestamp": "2026-02-28T15:30:00.000Z"
}
```

---

## Database Schema

### Collections Created

#### 1. `activities`
Stores daily aggregated metrics per project per day.

```typescript
{
  _id: ObjectId,
  user_id: string,              // Firebase UID or MongoDB user ID
  project_name: string,          // e.g., "zenno-web"
  date: Date,                    // Normalized to start of day (UTC)
  languages: Map<string, number>, // {typescript: 3600, python: 1800}
  apps: Map<string, number>,     // {VSCode: 5400, Chrome: 1200}
  skills: Map<string, number>,   // {coding: 4000, debugging: 1400}
  context_states: Map<string, number>, // {coding: 5000, break: 400}
  behavior: {
    total_keystrokes: number,
    total_mouse_clicks: number,
    total_scroll_events: number,
    total_idle_sec: number
  },
  sync_version: number,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- Unique compound: `(user_id, project_name, date)`
- Optimizes queries like: "Get all activity for user X in project Y on date Z"

#### 2. `projects`
Stores project metadata and LOC snapshots.

```typescript
{
  _id: ObjectId,
  user_id: string,
  project_name: string,
  project_path: string,
  languages: Map<string, {
    lines_of_code: number,
    file_count: number,
    last_scanned_at: Date
  }>,
  first_seen_at: Date,
  last_active_at: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- Unique compound: `(user_id, project_name)`

---

## Key Features

### 1. **Atomic Transactions**
All data syncs in a single ACID transaction. If any part fails, the entire sync is rolled back.

```typescript
// Start transaction
session.startTransaction();

// Sync all tables
await syncDailyActivities(email, data, session);
await syncProjects(email, data, session);

// Commit or rollback
await session.commitTransaction();
```

### 2. **Upsert Operations**
Data is intelligently merged:
- **Existing records:** Updated with new metrics
- **New records:** Created automatically
- **Duplicates:** Prevented by unique indexes

### 3. **Date Normalization**
All dates are normalized to UTC start-of-day (`00:00:00.000Z`) for consistent grouping.

```typescript
const date = new Date(syncDto.date);
date.setUTCHours(0, 0, 0, 0); // Normalize to start of day
```

### 4. **User Context Extraction**
The API automatically converts `user_id` to the backend's MongoDB user ID and enriches response with current user data.

---

## Best Practices

### 1. **Sync Frequency**
- **Daily:** Sync accumulated activity once per day (recommended: end of day or start of next day)
- **Weekly:** For low-frequency syncs, batch multiple days in one request
- **Avoid:** Syncing more than once per hour (unnecessary load)

### 2. **Data Validation (Desktop Agent)**

Before sending, validate:

```typescript
// Validate date format
if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
  throw new Error('Date must be YYYY-MM-DD format');
}

// Validate duration
if (data.duration_sec < 0) {
  throw new Error('Duration cannot be negative');
}

// Normalize timestamps
data.last_scanned_at = new Date(data.last_scanned_at).toISOString();
```

### 3. **Batch Multiple Days**

Instead of syncing daily, batch 5-7 days in one request:

```typescript
const syncData = {
  data: {
    daily_languages: [
      // Day 1
      { date: "2026-02-23", language_name: "typescript", ... },
      // Day 2
      { date: "2026-02-24", language_name: "typescript", ... },
      // ... up to 7 days
    ]
  }
};
```

### 4. **Error Handling**

Implement retry logic with exponential backoff:

```typescript
async function syncWithRetry(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch('/api/v1/sync/activity', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(syncData)
      });

      if (response.ok) {
        return response.json();
      }

      if (response.status === 401) {
        // Token expired, refresh and retry
        const newToken = await getNewIdToken();
        idToken = newToken;
      }
    } catch (error) {
      const delay = Math.pow(2, i) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### 5. **Efficient Data Structure**

Use Maps to avoid sending `null` values:

```typescript
// ❌ INEFFICIENT (sends many nulls)
{
  languages: {
    typescript: 3600,
    python: 1800,
    javascript: null,
    java: null,
    // ... 20 more null entries
  }
}

// ✅ EFFICIENT (only sends actual data)
{
  languages: {
    typescript: 3600,
    python: 1800
  }
}
```

---

## Querying Synced Data

### Get Activity Summary for a Date Range

```bash
GET /api/v1/sync/activity/summary?start_date=2026-02-20&end_date=2026-02-28
Authorization: Bearer <firebase_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user_email": "user@example.com",
    "date_range": {
      "start": "2026-02-20T00:00:00.000Z",
      "end": "2026-02-28T23:59:59.999Z"
    },
    "total_activities": 45,
    "projects": ["zenno-web", "desktop-agent", "backend"],
    "activities": [
      {
        "_id": "...",
        "user_id": "...",
        "project_name": "zenno-web",
        "date": "2026-02-28T00:00:00.000Z",
        "languages": { "typescript": 3600, "python": 1800 },
        "apps": { "Visual Studio Code": 5400 },
        ...
      }
    ]
  }
}
```

---

## MongoDB Indexing Strategy

The system automatically creates these indexes:

```javascript
// Activity collection
db.activities.createIndex({ user_id: 1, project_name: 1, date: 1 }, { unique: true });

// Project collection
db.projects.createIndex({ user_id: 1, project_name: 1 }, { unique: true });
```

**Benefits:**
- ⚡ **Fast lookups:** `O(1)` average time
- 🔒 **Duplicate prevention:** Unique constraint prevents race conditions
- 📊 **Efficient aggregation:** Queries on `(user_id, date)` are optimized

---

## Troubleshooting

### "User not found"
- Ensure the user has signed up via `/api/v1/user/me` (PUT) first
- Verify the Firebase token is valid

### "Invalid request data"
- Check date format: must be `YYYY-MM-DD`
- Verify `duration_sec` is a positive integer
- Ensure all required fields are present

### "Sync failed: Database error"
- Check MongoDB connection
- Verify MongoDB Atlas IP whitelist includes your server

### Duplicate Records
- This should not happen due to unique indexes
- If it does, check for race conditions in the desktop agent
- Re-run sync—upsert will merge data correctly

---

## Migration from Raw Logs

If migrating from the raw SQLite database:

```typescript
// 1. Aggregate raw logs by (user_id, project_name, date)
const aggregated = {};
for (const log of rawLogs) {
  const key = `${log.user_id}:${log.project_name}:${log.date}`;
  if (!aggregated[key]) {
    aggregated[key] = { languages: {}, apps: {}, ... };
  }
  aggregated[key].languages[log.language] ??= 0;
  aggregated[key].languages[log.language] += log.duration_sec;
}

// 2. Send to sync endpoint
await fetch('/api/v1/sync/activity', {
  method: 'POST',
  body: JSON.stringify({
    data: {
      daily_languages: [...],
      daily_apps: [...],
      ...
    }
  })
});
```

---

## Summary

✅ **One comprehensive endpoint** for all activity data  
✅ **Atomic transactions** ensure data consistency  
✅ **Minimal schema** with efficient indexing  
✅ **User context automatically enriched** in response  
✅ **Easy to scale** with proper batching  
