import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useEvents, eventListOptions } from '#/lib/hooks/useEvents'
import { useUser } from '#/lib/hooks/useUser'
import { EventFilters } from '#/components/events/EventFilters'
import { EventTable } from '#/components/events/EventTable'
import { FullscreenMap, FullscreenMapSkeleton } from '#/components/maps/FullscreenMap'
import { LocationSearch, getSavedLocation } from '#/components/maps/LocationSearch'
import { Pagination } from '#/components/Pagination'
import { Spinner } from '#/components/Spinner'
import { DEFAULT_MAP_CENTER } from '#/lib/mapUtils'

interface EventsSearch {
  lat?: number
  lng?: number
  radius?: number
  date?: string
  endDate?: string
  category?: string
  search?: string
  view?: 'list'
  page?: number
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
    view: search.view === 'list' ? 'list' : undefined,
    page: search.page ? Number(search.page) : undefined,
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
    if (search.view === 'list') return <Spinner className="py-24" />
    return <FullscreenMapSkeleton />
  },
  component: EventsPage,
})

function todayString(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function EventsPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const { isSignedIn } = useAuth()
  const { data: user } = useUser()

  useEffect(() => {
    if (search.lat && search.lng) return

    const saved = getSavedLocation()
    if (saved) {
      navigate({
        to: '/events',
        search: (prev) => ({ ...prev, lat: saved.lat, lng: saved.lng }),
        replace: true,
      })
      return
    }

    if (isSignedIn && user?.DefaultLatitude && user?.DefaultLongitude) {
      navigate({
        to: '/events',
        search: (prev) => ({
          ...prev,
          lat: user.DefaultLatitude,
          lng: user.DefaultLongitude,
          radius: user.DefaultRadiusMiles,
        }),
        replace: true,
      })
    }
  }, [search.lat, search.lng, navigate, isSignedIn, user])

  const lat = search.lat ?? DEFAULT_MAP_CENTER.lat
  const lng = search.lng ?? DEFAULT_MAP_CENTER.lng

  if (search.view === 'list') {
    return <EventsList search={{ ...search, lat, lng }} />
  }

  return (
    <FullscreenMap
      lat={lat}
      lng={lng}
      radius={search.radius}
      date={search.date ?? todayString()}
      category={search.category}
    />
  )
}

function EventsList({
  search,
}: {
  search: EventsSearch & { lat: number; lng: number }
}) {
  const navigate = useNavigate()
  const [locationName, setLocationName] = useState<string | null>(null)

  useEffect(() => {
    const saved = getSavedLocation()
    if (saved) setLocationName(saved.name)
  }, [search.lat, search.lng])

  const page = search.page ?? 1

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

  const { data, isLoading } = useEvents(filters, true)
  const fetchedEvents = data?.events ?? []
  const total = data?.total ?? 0
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

      {isLoading ? (
        <Spinner className="py-12" />
      ) : (
        <EventTable events={fetchedEvents} />
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
      )}
    </div>
  )
}
