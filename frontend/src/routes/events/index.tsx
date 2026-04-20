import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useEvents, eventListOptions } from '#/lib/hooks/useEvents'
import { useUser } from '#/lib/hooks/useUser'
import { EventFilters } from '#/components/EventFilters'
import { EventCard } from '#/components/EventCard'
import { EventTable } from '#/components/EventTable'
import { EventMap } from '#/components/EventMap'
import { FullscreenMap, FullscreenMapSkeleton } from '#/components/FullscreenMap'
import { LocationSearch, getSavedLocation } from '#/components/LocationSearch'
import { Pagination } from '#/components/Pagination'
import { ViewToggle } from '#/components/ViewToggle'
import { Spinner } from '#/components/Spinner'

interface EventsSearch {
  lat?: number
  lng?: number
  radius?: number
  date?: string
  endDate?: string
  category?: string
  search?: string
  view?: 'map' | 'list'
  page?: number
  fullscreen?: 1
}

export const Route = createFileRoute('/events/')({
  head: () => ({
    meta: [
      { title: 'Explore Events | 919Events' },
      { name: 'description', content: 'Browse upcoming events near you — concerts, festivals, meetups, and more.' },
      { property: 'og:title', content: 'Explore Events | 919Events' },
      { property: 'og:description', content: 'Browse upcoming events near you — concerts, festivals, meetups, and more.' },
    ],
    links: [
      { rel: 'canonical', href: 'https://919events.com/events' },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): EventsSearch => ({
    lat: search.lat ? Number(search.lat) : undefined,
    lng: search.lng ? Number(search.lng) : undefined,
    radius: search.radius ? Number(search.radius) : undefined,
    date: (search.date as string) || undefined,
    endDate: (search.endDate as string) || undefined,
    category: search.category as string | undefined,
    search: (search.search as string) || undefined,
    view: (search.view as 'map' | 'list') || undefined,
    page: search.page ? Number(search.page) : undefined,
    fullscreen: search.fullscreen ? 1 : undefined,
  }),
  loaderDeps: ({ search }) => ({
    lat: search.lat,
    lng: search.lng,
    radius: search.radius,
    date: search.date,
    endDate: search.endDate,
    category: search.category,
    search: search.search,
    page: search.page,
  }),
  loader: async ({ context, deps }) => {
    if (deps.lat && deps.lng) {
      await context.queryClient.prefetchQuery(
        eventListOptions({
          lat: deps.lat,
          lng: deps.lng,
          radius: deps.radius,
          date: deps.date,
          endDate: deps.endDate,
          category: deps.category,
          search: deps.search,
          page: deps.page,
        }),
      )
    }
  },
  pendingComponent: function EventsPending() {
    const search = Route.useSearch()
    if (search.fullscreen) return <FullscreenMapSkeleton />
    return <Spinner className="py-24" />
  },
  component: EventsPage,
})

function EventsPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const { isSignedIn } = useAuth()
  const { data: user } = useUser()

  useEffect(() => {
    if (search.lat && search.lng) return

    // 1. Try localStorage
    const saved = getSavedLocation()
    if (saved) {
      navigate({
        to: '/events',
        search: {
          lat: saved.lat,
          lng: saved.lng,
        },
        replace: true,
      })
      return
    }

    // 2. Try user profile defaults
    if (isSignedIn && user?.DefaultLatitude && user?.DefaultLongitude) {
      navigate({
        to: '/events',
        search: {
          lat: user.DefaultLatitude,
          lng: user.DefaultLongitude,
          radius: user.DefaultRadiusMiles,
        },
        replace: true,
      })
    }
  }, [search.lat, search.lng, navigate, isSignedIn, user])

  if (!search.lat || !search.lng) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-(--sea-ink)">Explore Events</h1>
        <div className="flex flex-col items-center gap-4 py-16">
          <p className="text-(--sea-ink-soft)">
            Search for a city to find events near you.
          </p>
          <LocationSearch />
        </div>
      </div>
    )
  }

  return (
    <EventsList search={{ ...search, lat: search.lat, lng: search.lng }} />
  )
}

function EventsList({
  search,
}: {
  search: EventsSearch & { lat: number; lng: number }
}) {
  const navigate = useNavigate()
  const [locationName, setLocationName] = useState<string | null>(null)
  const fullscreen = !!search.fullscreen
  const setFullscreen = (val: boolean) => {
    navigate({
      to: '/events',
      search: (prev) => ({ ...prev, fullscreen: val ? 1 : undefined }),
    })
  }
  const [mapDisplayMode, setMapDisplayMode] = useState<'cards' | 'list'>('cards')

  useEffect(() => {
    const saved = getSavedLocation()
    if (saved) setLocationName(saved.name)
  }, [search.lat, search.lng])

  const view = search.view ?? 'list'
  const center = { lat: search.lat, lng: search.lng }
  const hasDate = !!search.date
  const page = search.page ?? 1

  // Map view requires a date; list view fetches without one (all upcoming)
  const shouldFetch = view === 'list' || hasDate

  const filters = {
    lat: search.lat,
    lng: search.lng,
    radius: search.radius,
    date: search.date,
    endDate: search.endDate,
    category: search.category,
    search: search.search,
    page,
  }

  const { data, isLoading } = useEvents(filters, shouldFetch)
  const fetchedEvents = shouldFetch ? (data?.events ?? []) : []
  const total = data?.total ?? 0

  // Separate unpaginated fetch for map markers (all events, not just current page)
  const mapFilters = {
    lat: search.lat,
    lng: search.lng,
    radius: search.radius,
    date: search.date,
    endDate: search.endDate,
    category: search.category,
    search: search.search,
    limit: 500,
  }
  const { data: mapData } = useEvents(mapFilters, view === 'map' && hasDate)
  const mapEvents = (view === 'map' && hasDate) ? (mapData?.events ?? []) : []
  const pageSize = 20
  const totalPages = Math.ceil(total / pageSize)

  function goToPage(p: number) {
    navigate({
      to: '/events',
      search: (prev) => ({ ...prev, page: p > 1 ? p : undefined }),
      replace: true,
      resetScroll: false,
    })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-(--sea-ink)">Explore Events</h1>
        <LocationSearch compact />
      </div>

      <EventFilters
        category={search.category}
        date={search.date}
        endDate={search.endDate}
        radius={search.radius}
        search={search.search}
        view={view}
        lat={search.lat}
        lng={search.lng}
      />

      {(locationName || search.date || search.category || search.search) && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-(--sea-ink-soft)">
          <span>Showing events</span>
          {search.search && (
            <span className="rounded-full bg-[rgba(123,142,232,0.14)] px-2.5 py-0.5 font-medium text-(--lagoon-deep)">
              "{search.search}"
            </span>
          )}
          <span>within {search.radius ?? 10} mi</span>
          {locationName && (
            <span className="rounded-full bg-[rgba(123,142,232,0.14)] px-2.5 py-0.5 font-medium text-(--lagoon-deep)">
              {locationName}
            </span>
          )}
          {search.date && (
            <span className="rounded-full bg-[rgba(123,142,232,0.14)] px-2.5 py-0.5 font-medium text-(--lagoon-deep)">
              {new Date(search.date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {search.endDate && search.endDate !== search.date && (
                <> &ndash; {new Date(search.endDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
              )}
            </span>
          )}
          {search.category && (
            <span className="rounded-full bg-[rgba(123,142,232,0.14)] px-2.5 py-0.5 font-medium text-(--lagoon-deep)">
              {search.category}
            </span>
          )}
          {(search.date || search.category || search.radius || search.search) && (
            <button
              onClick={() =>
                navigate({
                  to: '/events',
                  search: (prev) => ({ ...prev, date: undefined, endDate: undefined, category: undefined, radius: undefined, search: undefined, page: undefined }),
                  replace: true,
                })
              }
              className="ml-1 cursor-pointer rounded-full border border-(--line) px-2.5 py-0.5 font-medium text-(--sea-ink-soft) hover:border-(--lagoon-deep) hover:text-(--lagoon-deep)"
            >
              Clear filters ×
            </button>
          )}
        </div>
      )}

      {fullscreen && (
        <FullscreenMap
          lat={search.lat}
          lng={search.lng}
          radius={search.radius}
          date={search.date}
          category={search.category}
          onClose={() => setFullscreen(false)}
                 />
      )}

      {view === 'map' && !hasDate ? (
        <div className="relative">
          <EventMap events={[]} center={center} radiusMiles={search.radius ?? 10} />
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-(--bg-base)/60 backdrop-blur-sm">
            <div className="rounded-xl border border-(--line) bg-(--surface-strong) px-8 py-6 text-center shadow-lg">
              <p className="text-lg font-semibold text-(--sea-ink)">
                Select a date to view events on the map
              </p>
              <p className="mt-1 text-sm text-(--sea-ink-soft)">
                Or view the list to see all events
              </p>
            </div>
          </div>
          <button
            onClick={() => setFullscreen(true)}
            className="absolute top-3 left-3 z-20 flex h-9 w-9 items-center justify-center rounded-lg border border-(--line) bg-(--surface-strong) backdrop-blur-lg text-(--sea-ink) shadow-lg hover:bg-(--surface) cursor-pointer"
            aria-label="Fullscreen map"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2h4v4M6 14H2v-4M14 2l-5 5M2 14l5-5" />
            </svg>
          </button>
        </div>
      ) : isLoading ? (
        <Spinner className="py-12" />
      ) : view === 'map' ? (
        <div className="space-y-4">
          <div className="relative">
            <EventMap events={mapEvents} center={center} radiusMiles={search.radius ?? 10} />
            <button
              onClick={() => setFullscreen(true)}
              className="absolute top-3 left-3 z-20 flex h-9 w-9 items-center justify-center rounded-lg border border-(--line) bg-(--surface-strong) backdrop-blur-lg text-(--sea-ink) shadow-lg hover:bg-(--surface) cursor-pointer"
              aria-label="Fullscreen map"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 2h4v4M6 14H2v-4M14 2l-5 5M2 14l5-5" />
              </svg>
            </button>
          </div>
          <div className="flex justify-end">
            <ViewToggle view={mapDisplayMode} onChange={setMapDisplayMode} />
          </div>
          {mapDisplayMode === 'cards' ? (
            <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
              {fetchedEvents.map((event) => (
                <div key={event.ID} className="mb-4 break-inside-avoid">
                  <EventCard event={event} />
                </div>
              ))}
            </div>
          ) : (
            <EventTable events={fetchedEvents} />
          )}
        </div>
      ) : (
        <EventTable events={fetchedEvents} />
      )}

      {/* Pagination */}
      {shouldFetch && totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
      )}
    </div>
  )
}
