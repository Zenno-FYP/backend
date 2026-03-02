# Performance Metrics API Documentation

## Endpoint Overview

**Base URL:** `http://localhost:3000/api/v1`

**Endpoint:** `GET /dashboard/performance-metrics`

**Description:** Retrieves comprehensive performance metrics for the current user comparing last 7 days with previous 7 days.

---

## Authentication

- **Type:** Bearer Token (Firebase JWT)
- **Required:** Yes
- **Header:** `Authorization: Bearer {firebase_token}`

---

## Request

```http
GET /dashboard/performance-metrics HTTP/1.1
Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ...
```

### Query Parameters

None. Metrics are calculated for the authenticated user.

---

## Response

### HTTP Status Code

- **200 OK** - Metrics retrieved successfully
- **401 Unauthorized** - Invalid or missing Firebase token
- **404 Not Found** - User not found in database

### Response Headers

```
Content-Type: application/json
```

### Response Body

```json
{
  "period": "last_7_days",
  "sync_timestamp": "2026-03-02T15:06:35.843Z",
  "performance_summary": {
    "wpm": {
      "value": 6.7,
      "unit": "words/min",
      "change_percent": 0,
      "trend": "up"
    },
    "daily_active_average": {
      "value": 1.6,
      "unit": "hours/day",
      "change_percent": 0,
      "trend": "up"
    },
    "total_clicks": {
      "value": 473,
      "unit": "clicks",
      "change_percent": 0,
      "trend": "up"
    },
    "total_scrolls": {
      "value": 116,
      "unit": "scrolls",
      "change_percent": 0,
      "trend": "up"
    }
  },
  "usage_trend_graph": [
    {
      "date": "2026-02-24",
      "day_name": "Tue",
      "focused_hours": 0,
      "reading_hours": 0,
      "distracted_hours": 0,
      "idle_hours": 0,
      "total_active_hours": 0
    },
    {
      "date": "2026-02-25",
      "day_name": "Wed",
      "focused_hours": 0,
      "reading_hours": 0,
      "distracted_hours": 0,
      "idle_hours": 0,
      "total_active_hours": 0
    },
    {
      "date": "2026-02-26",
      "day_name": "Thu",
      "focused_hours": 0,
      "reading_hours": 0,
      "distracted_hours": 0,
      "idle_hours": 0,
      "total_active_hours": 0
    },
    {
      "date": "2026-02-27",
      "day_name": "Fri",
      "focused_hours": 0,
      "reading_hours": 0,
      "distracted_hours": 0,
      "idle_hours": 0,
      "total_active_hours": 0
    },
    {
      "date": "2026-02-28",
      "day_name": "Sat",
      "focused_hours": 0,
      "reading_hours": 0,
      "distracted_hours": 0,
      "idle_hours": 0,
      "total_active_hours": 0
    },
    {
      "date": "2026-03-01",
      "day_name": "Sun",
      "focused_hours": 0,
      "reading_hours": 0,
      "distracted_hours": 0,
      "idle_hours": 0,
      "total_active_hours": 0
    },
    {
      "date": "2026-03-02",
      "day_name": "Mon",
      "focused_hours": 0.7,
      "reading_hours": 0,
      "distracted_hours": 0.6,
      "idle_hours": 0.4,
      "total_active_hours": 1.6
    }
  ]
}
```

---

## Response Field Descriptions

### Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `period` | string | Fixed value: `"last_7_days"` - indicates the metrics period |
| `sync_timestamp` | string | ISO 8601 timestamp when metrics were calculated |
| `performance_summary` | object | Summary metrics with trend data |
| `usage_trend_graph` | array | 7-day daily breakdown for stacked bar chart |

---

## Performance Summary Fields

### WPM (Words Per Minute)

```json
{
  "value": 6.7,
  "unit": "words/min",
  "change_percent": 0,
  "trend": "up"
}
```

| Field | Description |
|-------|-------------|
| `value` | Typing speed: (total keystrokes / 5) / (total active minutes) |
| `unit` | Always `"words/min"` |
| `change_percent` | Percentage change vs previous 7 days: `((current - previous) / previous) × 100` |
| `trend` | `"up"` (improved), `"down"` (declined), or `"neutral"` (no change) |

**Formula:** `WPM = (Keystrokes / 5) / (Focused + Reading + Distracted + Idle minutes)`

**Data Source:** `activity.behavior.keystrokes` and all context state durations

---

### Daily Active Average

```json
{
  "value": 1.6,
  "unit": "hours/day",
  "change_percent": 0,
  "trend": "up"
}
```

| Field | Description |
|-------|-------------|
| `value` | Average active hours per day with activity |
| `unit` | Always `"hours/day"` |
| `change_percent` | Percentage change vs previous 7 days |
| `trend` | Trend direction (`"up"`, `"down"`, or `"neutral"`) |

**Formula:** `Daily Average = Total Duration Hours / Count of Days with Activity`

**Data Source:** Sum of all context states (Focused + Reading + Distracted + Idle)

**Note:** Only counts days with at least one activity record. Zero-activity days excluded.

---

### Total Clicks

```json
{
  "value": 473,
  "unit": "clicks",
  "change_percent": 0,
  "trend": "up"
}
```

| Field | Description |
|-------|-------------|
| `value` | Total mouse clicks across all 7 days and all projects |
| `unit` | Always `"clicks"` |
| `change_percent` | Percentage change vs previous 7 days |
| `trend` | Trend direction |

**Data Source:** Sum of `activity.behavior.clicks` from all activities

**Aggregation:** Combined from ALL projects for the 7-day period

---

### Total Scrolls

```json
{
  "value": 116,
  "unit": "scrolls",
  "change_percent": 0,
  "trend": "up"
}
```

| Field | Description |
|-------|-------------|
| `value` | Total scroll events across all 7 days and all projects |
| `unit` | Always `"scrolls"` |
| `change_percent` | Percentage change vs previous 7 days |
| `trend` | Trend direction |

**Data Source:** Sum of `activity.behavior.scrolls` from all activities

**Aggregation:** Combined from ALL projects for the 7-day period

---

## Usage Trend Graph (Daily Breakdown)

Array of 7 daily objects showing time breakdown per day, starting from Today-6 through Today.

### Daily Object Structure

```json
{
  "date": "2026-03-02",
  "day_name": "Mon",
  "focused_hours": 0.7,
  "reading_hours": 0,
  "distracted_hours": 0.6,
  "idle_hours": 0.4,
  "total_active_hours": 1.6
}
```

| Field | Type | Description |
|-------|------|-------------|
| `date` | string | Date in YYYY-MM-DD format |
| `day_name` | string | Day abbreviation (Sun, Mon, Tue, Wed, Thu, Fri, Sat) |
| `focused_hours` | number | Hours spent in Focused state (coding, debugging, testing) |
| `reading_hours` | number | Hours spent in Reading state (documentation, research) |
| `distracted_hours` | number | Hours spent in Distracted state (communication, social media, entertainment) |
| `idle_hours` | number | Hours user was in Idle state (away, not at computer) |
| `total_active_hours` | number | Sum of all context states (focused + reading + distracted + idle) |

### Data Aggregation

- **Multi-Project:** When multiple projects have activities on the same day, their durations are summed
- **Context States:** Extracted from `activity.context` object (set by desktop agent)
- **Rounding:** All hour values rounded to nearest 0.1 hours (6 minutes)

### Context States

| Context State | Sources | Description |
|---------------|---------|-------------|
| Focused | Focused, coding, debugging, testing | Core development work |
| Reading | Reading, research, documentation | Learning and reference materials |
| Distracted | Distracted, communication, entertainment | Non-productive activities |
| Idle | Idle | User away or not actively using system |

---

## Date/Time Ranges

### Current Period (used for performance_summary values)
- **Start:** Today at 00:00 UTC - 6 days
- **End:** Today at 23:59 UTC
- **Total:** 7 calendar days inclusive

### Previous Period (used for trend comparison)
- **Start:** Yesterday-6 days at 00:00 UTC - 6 days (i.e., Today-13 days)
- **End:** Yesterday-1 day at 23:59 UTC (i.e., Today-7 days)
- **Total:** 7 calendar days inclusive

### Example
If today is **March 2, 2026 (Monday)**:
- **Current Period:** Feb 24 - Mar 2 (inclusive)
- **Previous Period:** Feb 17 - Feb 23 (inclusive)
- **Comparison:** This week's metrics vs last week's metrics

---

## Calculation Logic

### Trend Percentage

```
if (previous_value == 0 and current_value > 0):
  change_percent = 100  (100% growth from no previous data)

if (previous_value == 0 and current_value == 0):
  change_percent = 0    (no change)

if (previous_value > 0):
  change_percent = ((current_value - previous_value) / previous_value) × 100
```

- Returns `100` when there's no previous data but current data exists (100% growth)
- Returns `0` when both previous and current are zero (no change)
- Rounded to 1 decimal place

### Trend Direction

```
if (current > previous): "up"
if (current < previous): "down"
if (current == previous): "neutral"
```

**Exception:** For `system_idle_time`, trend logic is reversed:
```
if (current < previous): "up"    (less idle time = good)
if (current > previous): "down"  (more idle time = bad)
if (current == previous): "neutral"
```

---

## Example Use Cases

### 1. Weekly Performance Check
Use `performance_summary` to show:
- Are you typing faster this week than last week?
- Are you spending more time coding?
- Are you getting distracted more?

### 2. Daily Activity Visualization
Use `usage_trend_graph` to create a stacked bar chart showing:
- Which days you were most productive?
- How activity distributes across context states?
- Trend across the 7-day period?

### 3. Idle Time Analysis
- `context.Idle` in daily breakdown shows when user was away or not at computer
- Use for understanding when user took breaks

---

## Error Responses

### 401 Unauthorized

```json
{
  "statusCode": 401,
  "message": "Unauthorized - Invalid firebase token"
}
```

**Causes:**
- No `Authorization` header provided
- Token is expired
- Token is invalid/malformed

---

### 404 Not Found

```json
{
  "statusCode": 404,
  "message": "User not found"
}
```

**Causes:**
- User authenticated with Firebase but not registered in Zenno database
- User record was deleted

---

## cURL Example

```bash
curl -X GET "http://localhost:3000/api/v1/dashboard/performance-metrics" \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ..." \
  -H "Content-Type: application/json"
```

---

## JavaScript/Fetch Example

```javascript
const token = "YOUR_FIREBASE_TOKEN";

const response = await fetch(
  "http://localhost:3000/api/v1/dashboard/performance-metrics",
  {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  }
);

const metrics = await response.json();
console.log(metrics.performance_summary);
console.log(metrics.usage_trend_graph);
```

---

## Implementation Notes

### Data Collection
- All data aggregated from activities across ALL user projects
- No project filtering - returns unified view of productivity
- Activity records must have valid `user_id`, `date`, `context`, and `behavior` fields

### Performance Considerations
- Fetches 14 days of activity data (current 7 days + previous 7 days)
- Calculates metrics in-memory (no database aggregation)
- Query time: ~50-200ms depending on activity record count

### Timezone Handling
- All dates in response are UTC
- Date range calculations use UTC midnight
- Client responsible for converting to user's local timezone for display

---

## API Versioning

**Current Version:** v1

**Base Path:** `/api/v1/dashboard/`

---

## Related Endpoints (Planned)

- `GET /dashboard/tool-usage` - Tools usage breakdown
- `GET /dashboard/project-insights` - Per-project statistics

---

## Last Updated

**March 2, 2026**

---

## Changelog

### v1.0.0 (March 2, 2026)
- Initial release
- Performance metrics endpoint
- 7-day trend analysis
- Multi-project aggregation
- System idle time tracking
- Context state categorization
