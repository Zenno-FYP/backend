## Dashboard API Documentation

### Overview
The Dashboard API provides analytics and performance metrics for tracking productivity and activity patterns. It features a modular architecture ready for multiple dashboard endpoints.

**Base URL:** `http://localhost:3000/api/v1/dashboard`  
**Authentication:** Firebase ID Token (Bearer token)

---

## Endpoints

### 1. GET /performance-metrics

Retrieve performance metrics comparing the current 7 days vs the previous 7 days. Powers the top dashboard section with productivity trends and daily breakdowns.

**URL:**
```
GET /api/v1/dashboard/performance-metrics
```

**Authentication:**
```
Authorization: Bearer <firebase-id-token>
```

---

#### Request

**Headers:**
```
Authorization: Bearer <firebase-id-token>
Content-Type: application/json
```

No request body required.

---

#### Response (200 OK)

```json
{
  "period": "last_7_days",
  "sync_timestamp": "2026-03-02T14:30:00Z",
  "key_metrics": {
    "wpm": {
      "value": 48,
      "unit": "words/min",
      "change_percent": 5.2,
      "trend": "up"
    },
    "daily_active_average": {
      "value": 6.5,
      "unit": "hours/day",
      "change_percent": 1.5,
      "trend": "up"
    },
    "total_clicks": {
      "value": 15420,
      "unit": "clicks",
      "change_percent": -2.1,
      "trend": "down"
    },
    "total_scrolls": {
      "value": 8500,
      "unit": "scrolls",
      "change_percent": 12.5,
      "trend": "up"
    },
    "total_idle_time": {
      "value": 4.2,
      "unit": "hours",
      "change_percent": -10.0,
      "trend": "down"
    }
  },
  "usage_trend_graph": [
    {
      "date": "2026-02-24",
      "day_name": "Tue",
      "focused_hours": 4.5,
      "reading_hours": 1.5,
      "distracted_hours": 0.5,
      "idle_hours": 0.5,
      "total_active_hours": 7.0
    },
    {
      "date": "2026-02-25",
      "day_name": "Wed",
      "focused_hours": 5.2,
      "reading_hours": 1.2,
      "distracted_hours": 0.6,
      "idle_hours": 0.4,
      "total_active_hours": 7.4
    },
    {
      "date": "2026-02-26",
      "day_name": "Thu",
      "focused_hours": 4.8,
      "reading_hours": 1.8,
      "distracted_hours": 0.4,
      "idle_hours": 0.3,
      "total_active_hours": 7.3
    },
    {
      "date": "2026-02-27",
      "day_name": "Fri",
      "focused_hours": 3.5,
      "reading_hours": 2.0,
      "distracted_hours": 1.0,
      "idle_hours": 0.8,
      "total_active_hours": 7.3
    },
    {
      "date": "2026-02-28",
      "day_name": "Sat",
      "focused_hours": 2.2,
      "reading_hours": 1.5,
      "distracted_hours": 2.0,
      "idle_hours": 1.2,
      "total_active_hours": 6.9
    },
    {
      "date": "2026-03-01",
      "day_name": "Sun",
      "focused_hours": 1.8,
      "reading_hours": 1.2,
      "distracted_hours": 2.5,
      "idle_hours": 1.5,
      "total_active_hours": 7.0
    },
    {
      "date": "2026-03-02",
      "day_name": "Mon",
      "focused_hours": 5.2,
      "reading_hours": 0.8,
      "distracted_hours": 0.4,
      "idle_hours": 0.6,
      "total_active_hours": 7.0
    }
  ]
}
```

---

#### Response Fields Explained

**Top-Level:**
- `period` (string): The period type being analyzed (`last_7_days`)
- `sync_timestamp` (string ISO 8601): When metrics were calculated
- `key_metrics` (object): Summary metrics with trends
- `usage_trend_graph` (array): Daily breakdown for visualization

**Key Metrics:**
Each metric contains:
- `value` (number): The calculated metric value
- `unit` (string): Unit of measurement
- `change_percent` (number): Percentage change vs previous period (can be negative)
- `trend` (string): Direction - `up`, `down`, or `neutral`

**Metric Definitions:**

| Metric | Formula | Example |
|--------|---------|---------|
| **WPM** | (Total Keystrokes / 5) / (Total Active Minutes) | 48 words/min |
| **Daily Active Average** | Total Duration (Hours) / Count of Active Days | 6.5 hours/day |
| **Total Clicks** | Sum of all behavior.clicks | 15,420 clicks |
| **Total Scrolls** | Sum of all behavior.scrolls | 8,500 scrolls |
| **Total Idle Time** | Sum of behavior.idle_sec converted to hours | 4.2 hours |

**Usage Trend Graph (Daily Breakdown):**
Each daily bar contains:
- `date` (string YYYY-MM-DD): The date
- `day_name` (string): Short day name (Mon, Tue, etc.)
- `focused_hours` (number): Coding + Debugging + Testing (idle-normalized)
- `reading_hours` (number): Reading + Research + Documentation
- `distracted_hours` (number): Distracted + Communication + Entertainment
- `idle_hours` (number): Away/Idle time
- `total_active_hours` (number): Sum of all four categories (total bar height)

**Important:** Focused hours are normalized: `Focused = Max(0, Focused - Idle)` because idle time usually occurs during focused sessions.

---

#### Status Codes

| Code | Description |
|------|-------------|
| 200 | Performance metrics retrieved successfully |
| 401 | Unauthorized - Invalid or expired Firebase token |
| 404 | User not found |

---

#### Example cURL Request

```bash
curl -X GET http://localhost:3000/api/v1/dashboard/performance-metrics \
  -H "Authorization: Bearer <firebase-id-token>" \
  -H "Content-Type: application/json"
```

---

#### Example JavaScript Request

```javascript
const response = await fetch('http://localhost:3000/api/v1/dashboard/performance-metrics', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${firebaseToken}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log(data.key_metrics);
console.log(data.usage_trend_graph);
```

---

## Metrics Calculation Logic

### A. Date Ranges

**Current Period:** Last 7 days (Today to Today - 6 days inclusive)
```
Example: If today is 2026-03-02
Current: 2026-02-24 through 2026-03-02 (7 days)
```

**Previous Period:** 7 days before current (Today - 7 to Today - 13 days)
```
Example: If today is 2026-03-02
Previous: 2026-02-17 through 2026-02-23 (7 days)
```

### B. How Trends Are Calculated

Formula: `((Current_Value - Previous_Value) / Previous_Value) * 100`

**Examples:**
```
If Previous WPM = 45 and Current WPM = 48:
  Change = ((48 - 45) / 45) * 100 = 6.67%
  Trend = "up"

If Previous Clicks = 16000 and Current Clicks = 15420:
  Change = ((15420 - 16000) / 16000) * 100 = -3.63%
  Trend = "down"
```

**Special Case - Idle Time:**
For idle time, a *decrease* is positive productivity (trend = "down" is good):
```
If Previous Idle = 5.2h and Current Idle = 4.2h:
  Trend direction reverses: trend = "down" (which is good for idle)
```

### C. Activity Categorization

Activities are categorized from the `context` field in Activity documents:

```
Focused Hours:     context.coding + context.debugging + context.testing
Reading Hours:     context.reading + context.research + context.documentation
Distracted Hours:  context.distracted + context.communication + context.entertainment
Idle Hours:        behavior.idle_sec (converted to hours)
```

### D. Bar Chart Normalization

To ensure the stacked bar accurately represents total active time:

```
Raw Focused = 5.5 hours
Raw Idle = 0.8 hours

Normalized Focused = Max(0, 5.5 - 0.8) = 4.7 hours

Why? Idle often occurs during a focused task (bathroom break, etc.)
So we subtract it to avoid double-counting in the visual representation.
```

---

## Module Architecture

The dashboard module is designed for extensibility:

```
src/modules/dashboard/
├── dashboard.module.ts       # Module definition
├── dashboard.controller.ts   # HTTP routes
├── dashboard.service.ts      # Business logic
├── dto/
│   └── dashboard-metrics.dto.ts  # DTOs with Swagger decorators
```

**Key Design Patterns:**
- ✓ Separate service layer for reusability
- ✓ Type-safe DTOs with Swagger documentation
- ✓ Modular service methods for individual calculations
- ✓ Ready for additional dashboard endpoints (tool-usage, project-insights, etc.)
- ✓ Placeholder endpoints included for future APIs

---

## Future Endpoints (Placeholders Ready)

### GET /tool-usage
Get detailed breakdown of tool usage across projects and time periods.
*(Coming soon - implementation structure ready)*

### GET /project-insights
Get insights and analytics for each project.
*(Coming soon - implementation structure ready)*

---

## Error Handling

**401 Unauthorized:**
```json
{
  "statusCode": 401,
  "message": "Invalid or expired firebase token",
  "error": "Unauthorized"
}
```

**404 Not Found:**
```json
{
  "statusCode": 400,
  "message": "User not found",
  "error": "Bad Request"
}
```

---

## Notes

- All times are in UTC (ISO 8601 format)
- Rounding: Most values are rounded to 1 decimal place for display
- Activity records come from `POST /sync/activity` endpoint (Activity Module)
- Zero-activity days are included in the 7-day period with all values set to 0
- Previous period calculation allows trend analysis even for new users (returns 0 trend for first week)

**Last Updated:** March 2, 2026  
**Version:** 1.0.0
