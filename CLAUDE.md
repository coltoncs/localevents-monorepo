# LocalEvents

Full-stack application for discovering and managing local events. Monorepo with a Go backend and React frontend.

## Project Structure

```
.
├── frontend/          # React 19 + TanStack Start (SSR) — deployed to Cloudflare Workers
├── server/            # Go HTTP server (Chi router) — deployed to Railway
└── docker-compose.yml # Local PostgreSQL 16 + PostGIS
```

## Frontend (`./frontend`)

**Stack**: React 19, TanStack Start/Router/Query/Form, Vite 7, Tailwind CSS 4, TypeScript 5.7

- **Package manager**: pnpm
- **Dev server**: `pnpm dev` (port 3000), proxies `/api` to `localhost:8080`
- **Build/deploy**: `pnpm build && wrangler deploy` (Cloudflare Workers)
- **Linting/formatting**: Biome (`pnpm check`)
- **Auth**: Clerk (React SDK) — token injected into API client via `ClerkTokenProvider`
- **Maps**: Mapbox GL
- **Rich text**: Tiptap v3
- **Animations**: GSAP with ScrollTrigger

### Key directories

- `src/routes/` — File-based routing (TanStack Router). `__root.tsx` is the root layout.
- `src/components/` — Shared UI components (EventCard, Header, Footer, EventMap, etc.)
- `src/lib/api.ts` — Centralized fetch wrapper; adds Bearer token, handles errors.
- `src/lib/hooks/` — Data hooks (useEvents, useVenues, useSavedEvents, etc.)
- `src/lib/query-keys.ts` — TanStack Query key factory for cache management.
- `src/hooks/` — UI hooks (window size, breakpoints, cursor, throttle).
- `src/integrations/` — Clerk and TanStack Query providers.
- `src/styles/` — SCSS variables, animations, theming (light/dark via CSS custom properties).

### Path aliases

- `#/*` and `@/*` both resolve to `./src/*`

## Server (`./server`)

**Stack**: Go 1.24, Chi router, PostgreSQL + PostGIS, SQLC, Clerk JWT auth

- **Run locally**: `go run ./cmd/server` (port 8080)
- **Database queries**: SQLC — write SQL in `internal/store/queries.sql`, generate Go with `sqlc generate`
- **Migrations**: Custom runner in `internal/database/migrate.go`, SQL files in `migrations/`

### Key directories

- `cmd/server/main.go` — Entry point, starts HTTP server + cron jobs.
- `cmd/set-admin/` — CLI utility to set a user's admin role.
- `internal/router/router.go` — All API route definitions.
- `internal/handler/` — HTTP handlers (events, users, venues, applications, images, suggestions, notifications, digest, sitemap, health, sms_webhook).
- `internal/middleware/` — Auth (Clerk JWT), RBAC roles, CORS.
- `internal/store/` — SQLC-generated query code + models.
- `internal/scraper/` — Cron-based event scrapers (Ticketmaster, SeatGeek, Bandsintown, City of Raleigh, Discover Durham, Visit Richmond).
- `internal/notifier/` — Email (Resend) and SMS (Twilio) weekly digests.
- `internal/storage/r2.go` — Cloudflare R2 image storage (presigned uploads, mirroring).
- `internal/billing/clerk.go` — Clerk subscription/billing checks.
- `internal/config/` — Env-based configuration with defaults.

### API routes

All under `/api`. Auth levels:

- **Public**: `GET /health`, `GET /sitemap.xml`, `POST /sms/incoming`
- **Optional auth**: `GET /events`, `GET /events/{id}`, `GET /venues`, `GET /venues/{id}`
- **Authenticated**: `/me/*` (profile, saved events, notifications), `/images/*`, `/author-applications`, `/suggestions`
- **Author or Admin**: `POST/PUT/DELETE /events`, `POST/PUT /venues`, suggestion management
- **Admin only**: `/admin/*` (applications, digest trigger, suggestion list)

### Roles

Three roles stored in Clerk PublicMetadata: `user`, `author`, `admin`.

### Cron jobs

- Event scraping (default: every 6 hours)
- Weekly digest emails/SMS (default: Friday 9 AM ET)
- Cleanup of old events and orphaned images (default: Friday 8 AM ET, one hour before the digest so emails never reference images the next cleanup would have deleted)

## Database

PostgreSQL 16 with PostGIS. Key tables: users, events, venues, saved_events, author_applications, images, deleted_external_events, notifications, suggestions. Geospatial queries use `ST_DWithin` for radius search.

Local dev via docker-compose: `docker compose up -d` starts Postgres on port 5432.

## Environment

Both frontend and server read from `.env` files. See `.env.example` for required variables. Key vars:

- `DATABASE_URL` — Postgres connection string
- `CLERK_SECRET_KEY` — Clerk backend auth
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk frontend auth
- `VITE_API_URL` — Backend URL (production: `https://localevents-production.up.railway.app`)
- `VITE_MAPBOX_TOKEN` — Mapbox GL token
- Various API keys for scrapers (Ticketmaster, SeatGeek, Bandsintown)
- `R2_*` — Cloudflare R2 credentials
- `RESEND_API_KEY`, `TWILIO_*` — Notification service keys
