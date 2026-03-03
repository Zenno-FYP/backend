# Tool Usage API Documentation

## Endpoint
```
GET /api/v1/dashboard/tool-usage
```

## Authentication
- **Required**: Firebase Bearer Token
- **Header**: `Authorization: Bearer <firebase_token>`

## Response Structure

### Root Level
```json
{
  "period": "last_7_days",
  "sync_timestamp": "2026-03-03T09:05:12.889Z",
  "top_apps": { ... },
  "language_distribution": { ... }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `period` | string | Time period for the data (always "last_7_days") |
| `sync_timestamp` | string | ISO 8601 UTC timestamp when the data was synced |
| `top_apps` | object | Application usage statistics |
| `language_distribution` | object | Programming language analysis |

---

## Top Apps

### Structure
```json
{
  "total_usage_hours": 0.79,
  "usage_increase_from_yesterday_percent": 100,
  "apps": [
    {
      "name": "VS Code",
      "duration_hours": 0.58,
      "percent_of_total": 73,
      "change_percent": 100
    }
  ]
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `total_usage_hours` | number | Total hours all apps used in last 7 days (2 decimals) |
| `usage_increase_from_yesterday_percent` | number | Percentage change from yesterday to today (whole number) |
| `apps` | array | List of top applications |

### App Object
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Application name |
| `duration_hours` | number | Total usage hours for this app in last 7 days (2 decimals) |
| `percent_of_total` | number | Percentage of total usage (1 decimal) |
| `change_percent` | number | Percentage change from previous 7 days (whole number) |

**Example App:**
```json
{
  "name": "VS Code",
  "duration_hours": 0.58,
  "percent_of_total": 73,
  "change_percent": 100
}
```

---

## Language Distribution

### Structure
```json
{
  "summary": {
    "total_lines_of_code": 22766,
    "total_files": 69,
    "total_languages_used": 6
  },
  "languages": [
    {
      "name": "JSON",
      "percent": 52.9,
      "loc": 12036,
      "files": 5
    }
  ]
}
```

### Summary Object
| Field | Type | Description |
|-------|------|-------------|
| `total_lines_of_code` | number | Total lines of code across all languages |
| `total_files` | number | Total number of files edited |
| `total_languages_used` | number | Count of different languages used |

### Language Object
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Programming language name |
| `percent` | number | Percentage of total LOC (1 decimal) |
| `loc` | number | Lines of code written in this language |
| `files` | number | Number of files using this language |

**Example Language:**
```json
{
  "name": "Python",
  "percent": 31.5,
  "loc": 7173,
  "files": 36
}
```

---

## Complete Example Response

```json
{
  "period": "last_7_days",
  "sync_timestamp": "2026-03-03T09:05:12.889Z",
  "top_apps": {
    "total_usage_hours": 0.79,
    "usage_increase_from_yesterday_percent": 100,
    "apps": [
      {
        "name": "VS Code",
        "duration_hours": 0.58,
        "percent_of_total": 73,
        "change_percent": 100
      },
      {
        "name": "Brave",
        "duration_hours": 0.15,
        "percent_of_total": 18.6,
        "change_percent": 100
      },
      {
        "name": "Mongodbcompass",
        "duration_hours": 0.05,
        "percent_of_total": 6.7,
        "change_percent": 100
      },
      {
        "name": "Whatsapp",
        "duration_hours": 0.01,
        "percent_of_total": 1.1,
        "change_percent": 100
      },
      {
        "name": "Explorer",
        "duration_hours": 0.01,
        "percent_of_total": 0.7,
        "change_percent": 100
      }
    ]
  },
  "language_distribution": {
    "summary": {
      "total_lines_of_code": 22766,
      "total_files": 69,
      "total_languages_used": 6
    },
    "languages": [
      {
        "name": "JSON",
        "percent": 52.9,
        "loc": 12036,
        "files": 5
      },
      {
        "name": "Python",
        "percent": 31.5,
        "loc": 7173,
        "files": 36
      },
      {
        "name": "TypeScript",
        "percent": 8.1,
        "loc": 1849,
        "files": 23
      },
      {
        "name": "YAML",
        "percent": 2.7,
        "loc": 626,
        "files": 1
      },
      {
        "name": "Markdown",
        "percent": 2.5,
        "loc": 564,
        "files": 3
      }
    ]
  }
}
```

---

## Frontend Implementation Tips

### Displaying Top Apps
1. Show `total_usage_hours` at the top as main metric
2. Display `usage_increase_from_yesterday_percent` with trend indicator (🔴 down, 🟢 up)
3. Render apps as list/cards with:
   - App name and icon
   - Duration in hours (2 decimals)
   - Percentage bar (use `percent_of_total`)
   - Change indicator (use `change_percent`)

### Displaying Language Distribution
1. Show summary stats:
   - Total LOC
   - Total files
   - Languages used count
2. Create pie/bar chart with language percentages
3. Optional: Show LOC count and file count on hover/detail view

### Data Handling
- All timestamps are in UTC (Z suffix)
- Percentages are single values (not 0-100 range), use directly for display
- Hours are rounded to 2 decimal places, safe for display
- Data covers last 7 days (today back 6 days)

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

## Caching Notes
- Data is computed from last 7 days of activity syncs
- Refresh on demand or periodic polling recommended
- `sync_timestamp` indicates when this specific data was calculated
