# Project Insights API Documentation

## Endpoint
```
GET /api/v1/dashboard/project-insights
```

## Authentication
- **Required**: Firebase Bearer Token
- **Header**: `Authorization: Bearer <firebase_token>`

## Response Structure

### Root Level
```json
{
  "strongest_skills": [...],
  "current_projects": [...]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `strongest_skills` | array | Top 5 cumulative skills (all-time across all projects) |
| `current_projects` | array | All projects sorted by most recent activity first |

---

## Strongest Skills

### Structure
```json
{
  "strongest_skills": [
    {
      "name": "Coding",
      "percent": 55.4
    }
  ]
}
```

### Skill Object
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Skill name |
| `percent` | number | Percentage of total cumulative skill time (1 decimal place) |

**Note**: Skills are aggregated from all projects' cumulative `project_skills` data across entire project history.

**Example Skill:**
```json
{
  "name": "Coding",
  "percent": 55.4
}
```

---

## Current Projects

### Structure
```json
{
  "current_projects": [
    {
      "name": "Zenno-Dashboard",
      "last_active": "2026-03-05T18:30:00"
    }
  ]
}
```

### Project Object
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Project name |
| `last_active` | string | Most recent activity timestamp in local time (ISO 8601 without Z) |

**Note**: Projects are sorted by `last_active` in descending order (most recent first). Includes only projects with recorded activity.

**Example Project:**
```json
{
  "name": "Zenno-Dashboard",
  "last_active": "2026-03-05T18:30:00"
}
```

---

## Complete Example Response

```json
{
  "strongest_skills": [
    {
      "name": "Coding",
      "percent": 55.4
    },
    {
      "name": "Debugging",
      "percent": 25.1
    },
    {
      "name": "Research",
      "percent": 10.5
    },
    {
      "name": "Design",
      "percent": 5.0
    },
    {
      "name": "Testing",
      "percent": 4.0
    }
  ],
  "current_projects": [
    {
      "name": "Zenno-Dashboard",
      "last_active": "2026-03-05T18:30:00"
    },
    {
      "name": "Python-Script",
      "last_active": "2026-03-04T14:15:00"
    },
    {
      "name": "Backend-API",
      "last_active": "2026-03-03T22:45:30"
    },
    {
      "name": "Portfolio",
      "last_active": "2026-02-28T09:00:00"
    },
    {
      "name": "Mobile-App",
      "last_active": "2026-02-25T16:20:15"
    }
  ]
}
```

---

## Frontend Implementation Tips

### Displaying Strongest Skills
1. Create a horizontal bar chart showing each skill as a bar
2. Display skill name on the left
3. Show percentage on the bar or next to it
4. Use different colors for each skill
5. Optional: Show hours/time spent alongside percentage

### Displaying Current Projects
1. Show as a list of cards/rows
2. Display project name prominently
3. Display `last_active` as a relative time:
   - `"45 mins ago"` for recent activity
   - `"1 day ago"` for 24+ hours
   - `"5 days ago"` for older projects
4. Sort by recency (most recent is already first)
5. Optional: Add color coding by activity freshness
   - Green: Active in last 24 hours
   - Yellow: Active 2-7 days ago
   - Gray: Active more than 7 days ago

### Data Handling
- `last_active` is in local user time (no timezone conversion needed)
- Percentages are single values (not 0-100 range), use directly for display
- Skills sum to 100% (float rounding may cause minor variance)
- All timestamps are ISO 8601 format for consistent parsing

### Time Display Helper
```typescript
// Convert ISO string to relative time
function getRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 60) return `${diffMins} mins ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
  if (diffMins < 10080) return `${Math.floor(diffMins / 1440)} days ago`;
  
  return date.toLocaleDateString();
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "User not found"
}
```

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
  "message": "Internal server error"
}
```

---

## Data Notes

### Skill Aggregation
- Cumulative across **all projects**
- Calculated from `project_skills` array in Project schema
- Each skill's time is summed across all projects
- Percentage = (skill_duration_sec) / (total_duration_sec) × 100

### Project Activity
- `last_active` comes from the most recent `last_active_at` timestamp in each project
- Stored in user's local timezone
- Includes all projects with at least one activity
- Ordered by recency (newest first)

### Time Format
- Format: ISO 8601 without timezone indicator (e.g., `2026-03-05T18:30:00`)
- This timestamp is already in user's local time
- No Z suffix means local time (not UTC)
- Frontend should interpret as local time without conversion

---

## Example Usage

### Request
```bash
curl -X GET http://localhost:3000/api/v1/dashboard/project-insights \
  -H "Authorization: Bearer <firebase_token>"
```

### Response (200 OK)
```json
{
  "strongest_skills": [
    {
      "name": "Coding",
      "percent": 55.4
    },
    {
      "name": "Debugging",
      "percent": 25.1
    }
  ],
  "current_projects": [
    {
      "name": "Zenno-Dashboard",
      "last_active": "2026-03-05T18:30:00"
    },
    {
      "name": "Python-Script",
      "last_active": "2026-03-04T14:15:00"
    }
  ]
}
```

---

## Caching Notes
- Data is computed from Project collection and Project.project_skills array
- Refresh on demand or periodic polling recommended
- Skills percentages are computed fresh on each request (no caching)
- Project recency sorting is performed on retrieval (no pre-sorting)
