# LocalEvents Server API Documentation

Base URL: `/api`

All request/response bodies are JSON unless otherwise noted. Errors return `{"error": "message"}`.

---

## Authentication

Authentication uses **Clerk JWT** tokens passed as a Bearer token in the `Authorization` header:

```
Authorization: Bearer <clerk_jwt_token>
```

**Auth levels:**

| Level | Description |
|-------|-------------|
| Public | No authentication required |
| Optional Auth | Auth token accepted but not required (may enrich response) |
| Authenticated | Requires a signed-in user |
| Author/Admin | Requires `author` or `admin` role |
| Admin | Requires `admin` role |

**Roles:** `user`, `author`, `admin` (stored in Clerk PublicMetadata)

---

## Public Endpoints

### `GET /api/health`

Health check.

**Response** `200`
```json
{ "status": "ok" }
```

---

### `GET /api/sitemap.xml`

XML sitemap for SEO. Returns all event and venue URLs.

**Response** `200` — `Content-Type: application/xml`

---

### `GET /api/unsubscribe/{token}`

One-click unsubscribe from email/SMS notifications.

**Path params:**
- `token` (UUID) — unsubscribe token

**Response** `200` — HTML confirmation page

---

### `POST /api/sms/incoming`

Twilio inbound SMS webhook. Handles STOP/START keywords for SMS opt-in/out.

**Content-Type:** `application/x-www-form-urlencoded`

**Form fields:**
- `From` — phone number (E.164)
- `Body` — message text

**Recognized keywords:**
- Opt-out: `STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT`
- Opt-in: `START`, `UNSTOP`

**Response** `200` — Empty TwiML `<Response></Response>`

---

## Events (Optional Auth)

### `GET /api/events`

List events by location with optional filters.

**Query params:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `lat` | float | Yes | — | Latitude |
| `lng` | float | Yes | — | Longitude |
| `radius` | float | No | `10` | Radius in miles |
| `date` | string | No | today | Start date (`YYYY-MM-DD`) |
| `end_date` | string | No | — | End date (`YYYY-MM-DD`), inclusive |
| `category` | string | No | — | Filter by category |
| `venue` | string | No | — | Filter by venue name |
| `venue_id` | UUID | No | — | Filter by venue ID |
| `search` | string | No | — | Full-text search |
| `limit` | int | No | `20` | Results per page (max 500) |
| `page` | int | No | `1` | Page number |

**Response** `200`
```json
{
  "events": [
    {
      "ID": "uuid",
      "ExternalID": "string | null",
      "Source": "user | ticketmaster | seatgeek | bandsintown | ...",
      "Title": "string",
      "Description": "string | null",
      "VenueName": "string | null",
      "Address": "string | null",
      "City": "string | null",
      "State": "string | null",
      "Zip": "string | null",
      "Latitude": 35.7796,
      "Longitude": -78.6382,
      "StartTime": "2026-04-05T19:00:00Z",
      "EndTime": "2026-04-05T22:00:00Z | null",
      "ImageUrl": "string | null",
      "TicketUrl": "string | null",
      "PriceMin": "decimal | null",
      "PriceMax": "decimal | null",
      "SubmittedBy": "uuid | null",
      "CreatedAt": "timestamp",
      "UpdatedAt": "timestamp",
      "ManuallyEdited": false,
      "VenueID": "uuid | null",
      "Categories": ["music", "outdoor"],
      "SeriesID": "uuid | null"
    }
  ],
  "total": 42
}
```

**Sorting:** Single-date queries sort by time then proximity. Multi-day/no-date queries sort by day, proximity, then time.

---

### `GET /api/events/{id}`

Get a single event by ID.

**Path params:**
- `id` (UUID)

**Response** `200` — Single Event object (same shape as array element above)

**Errors:** `400` invalid ID, `404` not found

---

### `GET /api/events/{id}/save-count`

Get the number of users who saved an event.

**Path params:**
- `id` (UUID)

**Response** `200`
```json
{ "count": 5 }
```

---

### `GET /api/events/series/{seriesId}`

List all events in a recurring series.

**Path params:**
- `seriesId` (UUID)

**Response** `200` — Array of Event objects

---

### `GET /api/venues`

List venues by location.

**Query params:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `lat` | float | Yes | — | Latitude |
| `lng` | float | Yes | — | Longitude |
| `radius` | float | No | `100` | Radius in miles |

**Response** `200`
```json
{
  "venues": [
    {
      "ID": "uuid",
      "VenueName": "string",
      "Address": "string",
      "City": "string",
      "State": "string",
      "Zip": "string",
      "Latitude": 35.7796,
      "Longitude": -78.6382,
      "Hours": "string (optional)",
      "Description": "string (optional)"
    }
  ]
}
```

---

### `GET /api/venues/{id}`

Get a single venue by ID.

**Path params:**
- `id` (UUID)

**Response** `200` — Single venue object

**Errors:** `400` invalid ID, `404` not found

---

## User Profile (Authenticated)

### `GET /api/me`

Get or create the current user's profile. Syncs email from Clerk on each call.

**Response** `200` — User object
```json
{
  "ID": "uuid",
  "ClerkID": "string",
  "Username": "string | null",
  "Email": "string | null",
  "DefaultLatitude": 35.7796,
  "DefaultLongitude": -78.6382,
  "DefaultRadiusMiles": 10,
  "CreatedAt": "timestamp",
  "UpdatedAt": "timestamp",
  "PhoneNumber": "string | null"
}
```

---

### `PUT /api/me`

Update user settings (default location/radius).

**Request body:**
```json
{
  "default_latitude": 35.7796,
  "default_longitude": -78.6382,
  "default_radius_miles": 15
}
```
All fields are optional — only provided fields are updated.

**Response** `200` — Updated User object

---

### `GET /api/me/events`

List events submitted by the current user.

**Response** `200` — Array of Event objects

---

### `GET /api/me/saved`

List events saved/bookmarked by the current user.

**Response** `200` — Array of Event objects

---

### `POST /api/me/saved/{eventId}`

Save/bookmark an event.

**Path params:**
- `eventId` (UUID)

**Response** `201` — SavedEvent object
```json
{
  "ID": "uuid",
  "UserID": "uuid",
  "EventID": "uuid",
  "CreatedAt": "timestamp"
}
```

---

### `DELETE /api/me/saved/{eventId}`

Remove a saved/bookmarked event.

**Path params:**
- `eventId` (UUID)

**Response** `204` No Content

---

## Notifications (Authenticated)

### `GET /api/me/notifications`

Get the user's notification preferences.

**Response** `200`
```json
{
  "email_enabled": true,
  "sms_enabled": false,
  "phone_number": "+19195551234",
  "has_subscription": true,
  "preferred_categories": ["music", "food"]
}
```

---

### `PUT /api/me/notifications`

Update notification preferences.

**Request body:**
```json
{
  "email_enabled": true,
  "sms_enabled": true,
  "phone_number": "+19195551234",
  "preferred_categories": ["music"]
}
```

**Validation rules:**
- Email notifications require a valid email on the user profile
- SMS notifications require an active subscription and a phone number in E.164 format (`+1XXXXXXXXXX`)
- Both email and SMS require a default location set on the user profile
- Maximum 3 preferred categories

**Response** `200` — Updated preferences (same shape as GET)

---

### `POST /api/me/notifications/trigger-digest`

Trigger an immediate digest for the current user. Requires an active subscription.

**Response** `200`
```json
{ "status": "digest sent" }
```

**Errors:** `403` no active subscription, `422` digest generation failed

---

## Images (Authenticated)

### `POST /api/images/presign`

Generate a presigned URL for uploading an image to R2.

**Request body:**
```json
{
  "filename": "photo.jpg",
  "content_type": "image/jpeg"
}
```

**Response** `200`
```json
{
  "upload_url": "https://r2-presigned-upload-url...",
  "public_url": "https://pub-xxxxx.r2.dev/users/clerk_id/uuid.jpg",
  "key": "users/clerk_id/uuid.jpg"
}
```

The client should PUT the file directly to `upload_url`, then call `/images/confirm`.

---

### `POST /api/images/confirm`

Confirm an uploaded image and create a database record.

**Request body:**
```json
{
  "key": "users/clerk_id/uuid.jpg",
  "filename": "photo.jpg",
  "content_type": "image/jpeg",
  "size_bytes": 204800
}
```

**Response** `200` — Image object
```json
{
  "ID": "uuid",
  "UserID": "uuid",
  "R2Key": "users/clerk_id/uuid.jpg",
  "Url": "https://pub-xxxxx.r2.dev/users/clerk_id/uuid.jpg",
  "Filename": "photo.jpg",
  "ContentType": "image/jpeg",
  "SizeBytes": 204800,
  "CreatedAt": "timestamp"
}
```

---

### `GET /api/images`

List the current user's uploaded images.

**Response** `200` — Array of Image objects

---

### `DELETE /api/images/{id}`

Delete an image (removes from R2 and database).

**Path params:**
- `id` (UUID)

**Response** `204` No Content

---

## Author Applications (Authenticated)

### `POST /api/author-applications`

Submit an application to become an author.

**Request body:**
```json
{
  "full_name": "Jane Doe",
  "email": "jane@example.com",
  "bio": "Event organizer in the Triangle area...",
  "experience": "5 years organizing community events..."
}
```
All fields required.

**Response** `201` — AuthorApplication object

**Errors:** `409` already has a pending application

---

### `GET /api/me/application`

Get the current user's author application.

**Response** `200` — AuthorApplication object
```json
{
  "ID": "uuid",
  "ClerkID": "string",
  "FullName": "string",
  "Email": "string",
  "Bio": "string",
  "Experience": "string",
  "Status": "pending | approved | rejected",
  "SubmittedAt": "timestamp",
  "ReviewedAt": "timestamp | null",
  "ReviewedBy": "string | null",
  "ReviewNotes": "string | null"
}
```

**Errors:** `404` no application found

---

## Suggestions (Authenticated / Author)

### `POST /api/suggestions`

Submit an edit suggestion for an event or venue. Any authenticated user can submit.

**Request body:**
```json
{
  "target_type": "event | venue",
  "target_id": "uuid",
  "proposed_changes": {
    "title": "Updated Title",
    "description": "Fixed description"
  }
}
```

**Allowed fields for events:** `title`, `description`, `venue_name`, `address`, `city`, `state`, `zip`, `latitude`, `longitude`, `start_time`, `end_time`, `categories`, `image_url`, `ticket_url`, `price_min`, `price_max`

**Allowed fields for venues:** `name`, `address`, `city`, `state`, `zip`, `latitude`, `longitude`, `hours`, `description`

**Response** `201` — Suggestion object

---

### `GET /api/me/suggestions` (Author/Admin)

List pending edit suggestions for the current author's events.

**Response** `200` — Array of Suggestion objects

---

### `POST /api/suggestions/{id}/approve` (Author/Admin)

Approve a suggestion and apply the changes to the target. Authors can only approve suggestions on their own events. Admins can approve any.

**Path params:**
- `id` (UUID)

**Request body (optional):**
```json
{ "review_notes": "Looks good!" }
```

**Response** `200` — Updated Suggestion object

---

### `POST /api/suggestions/{id}/reject` (Author/Admin)

Reject a suggestion. Same authorization rules as approve.

**Path params:**
- `id` (UUID)

**Request body (optional):**
```json
{ "review_notes": "Incorrect information" }
```

**Response** `200` — Updated Suggestion object

---

## Events Management (Author/Admin)

### `POST /api/events`

Create a new event.

**Request body:**
```json
{
  "title": "Concert in the Park",
  "description": "A great outdoor show",
  "venue_name": "Dorothea Dix Park",
  "address": "1030 Richardson Dr",
  "city": "Raleigh",
  "state": "NC",
  "zip": "27603",
  "latitude": 35.7657,
  "longitude": -78.6568,
  "start_time": "2026-04-10T19:00:00-04:00",
  "end_time": "2026-04-10T22:00:00-04:00",
  "categories": ["music", "outdoor"],
  "image_url": "https://example.com/photo.jpg",
  "ticket_url": "https://tickets.example.com/123",
  "price_min": 15.00,
  "price_max": 45.00,
  "venue_id": "uuid (optional)",
  "series_id": "uuid (optional)"
}
```

**Required:** `title`, `start_time` (RFC 3339)

If `venue_id` is not provided but `venue_name` + coordinates are, a venue is auto-created/matched. External image URLs are automatically mirrored to R2.

**Response** `201` — Event object

---

### `PUT /api/events/{id}`

Update an event. Authors can only update their own events; admins can update any.

**Path params:**
- `id` (UUID)

**Request body:** Same shape as create.

**Response** `200` — Updated Event object

---

### `PUT /api/events/series/{seriesId}`

Update all events in a series (shared fields only — does not change individual start/end times).

**Path params:**
- `seriesId` (UUID)

**Request body:** Same shape as create (times are ignored for series updates).

**Response** `200` — Array of updated Event objects

---

### `DELETE /api/events/{id}`

Delete an event. Tracks external event deletions to prevent re-scraping.

**Path params:**
- `id` (UUID)

**Response** `204` No Content

---

## Venues Management (Author/Admin)

### `POST /api/venues`

Create a new venue.

**Request body:**
```json
{
  "name": "The Pour House",
  "address": "224 S Blount St",
  "city": "Raleigh",
  "state": "NC",
  "zip": "27601",
  "latitude": 35.7762,
  "longitude": -78.6370,
  "hours": "Mon-Sun 4pm-2am",
  "description": "Live music venue in downtown Raleigh"
}
```

**Required:** `name`

**Response** `201` — Venue object

---

### `PUT /api/venues/{id}`

Update a venue.

**Path params:**
- `id` (UUID)

**Request body:** Same shape as create.

**Response** `200` — Updated Venue object

---

## Admin Endpoints

### `GET /api/admin/applications`

List all pending author applications.

**Response** `200` — Array of AuthorApplication objects

---

### `POST /api/admin/applications/{id}/approve`

Approve an author application. Promotes the user to the `author` role in Clerk.

**Path params:**
- `id` (UUID)

**Request body (optional):**
```json
{ "review_notes": "Welcome aboard!" }
```

**Response** `200` — Updated AuthorApplication object

---

### `POST /api/admin/applications/{id}/reject`

Reject an author application.

**Path params:**
- `id` (UUID)

**Request body (optional):**
```json
{ "review_notes": "Not enough experience" }
```

**Response** `200` — Updated AuthorApplication object

---

### `GET /api/admin/suggestions`

List all pending edit suggestions (across all events/venues).

**Response** `200` — Array of Suggestion objects (with `TargetName` resolved)

---

### `POST /api/admin/digest/trigger`

Trigger the weekly digest for all subscribed users. Runs asynchronously.

**Response** `200`
```json
{ "status": "digest triggered" }
```

---

### `GET /api/admin/stats`

Get platform statistics dashboard data.

**Response** `200`
```json
{
  "total_users": 150,
  "new_users_this_week": 12,
  "weekly_active_users": 45,
  "email_subscribers": 30,
  "sms_subscribers": 8,
  "total_upcoming_events": 200,
  "total_venues": 75,
  "total_saved_events": 320,
  "pending_suggestions": 3,
  "pending_applications": 1,
  "events_by_source": [
    { "source": "ticketmaster", "count": 80 },
    { "source": "user", "count": 40 }
  ],
  "authors": [
    { "name": "Jane Doe", "email": "jane@example.com", "event_count": 15 }
  ],
  "recent_digests": {
    "sent": 25,
    "failed": 2,
    "total_events_included": 150
  },
  "last_scrape": {
    "ran_at": "2026-04-01T06:00:00Z",
    "items_affected": 45,
    "details": {}
  },
  "last_cleanup": {
    "ran_at": "2026-04-01T03:00:00Z",
    "items_affected": 12,
    "details": {}
  }
}
```
