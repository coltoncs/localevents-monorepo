# Event Views for Authors & Admins

Track how many times each event is viewed by authenticated users. Display counts on events themselves and an overall summary on the admin dashboard.

## Design Decisions

- **Authenticated only** — skip tracking for anonymous/unauthenticated requests to avoid scraper/bot writes inflating the DB
- **Dedup window** — 1 hour per user per event (standard approach)
- **Display** — view count on individual events + overall stats on admin dashboard
- **Aggregation** — increment-on-write (no cron jobs or separate summary tables)

## Database Changes

### Add `view_count` column to `events` table

```sql
ALTER TABLE events ADD COLUMN view_count INT NOT NULL DEFAULT 0;
```

### Create `event_views` table (for dedup only)

```sql
CREATE TABLE event_views (
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (event_id, user_id)
);

CREATE INDEX idx_event_views_user_id ON event_views(user_id);
```

- UNIQUE by design (composite PK) — one row per user-event pair, bounded growth
- `last_viewed_at` used for the 1-hour dedup window

## Backend Changes

### SQLC Queries (add to `queries.sql`)

```sql
-- name: UpsertEventView :one
INSERT INTO event_views (event_id, user_id, last_viewed_at)
VALUES ($1, $2, NOW())
ON CONFLICT (event_id, user_id)
DO UPDATE SET last_viewed_at = NOW()
WHERE event_views.last_viewed_at < NOW() - INTERVAL '1 hour'
RETURNING last_viewed_at;

-- name: IncrementEventViewCount :exec
UPDATE events SET view_count = view_count + 1 WHERE id = $1;

-- name: AdminTopEventsByViews :many
SELECT id, title, view_count, start_time
FROM events
WHERE start_time >= NOW()
ORDER BY view_count DESC
LIMIT 20;

-- name: AuthorEventViewStats :many
SELECT id, title, view_count, start_time
FROM events
WHERE submitted_by = $1
ORDER BY start_time ASC;
```

### Handler Changes

**`events.go` — `Get()` handler:**
- After fetching the event, if user is authenticated:
  1. Call `UpsertEventView` — if it returns a row, the dedup window passed, so also call `IncrementEventViewCount`
  2. If no row returned (conflict but no update), skip the increment
- View count is already on the event object from the initial fetch

**`admin.go` — `GetStats()` handler:**
- Add total views across all events and top events by views to the admin stats response

### API Response

No new endpoints needed. The `view_count` field comes back with the existing event response since it's a column on the events table.

## Frontend Changes

### Types (`lib/types.ts`)
- Add `view_count: number` to the Event interface

### Event Detail Page (`routes/events/$eventId/index.tsx`)
- Display view count alongside existing save count

### Admin Dashboard (`routes/admin.tsx`)
- Add "Total Event Views" metric
- Add "Top Events by Views" section

### My Events / Author Dashboard (`routes/my-events.tsx`)
- Show view count column in the author's event list

## Key Properties

- **Bounded table growth** — `event_views` maxes out at (users x events)
- **No aggregation jobs** — count is always current
- **Cheap reads** — `view_count` returned with the event already being fetched
- **No bot noise** — only authenticated users are tracked
- **Loses** — time-series analytics (views per day/week); can be added later with a raw log table if needed
