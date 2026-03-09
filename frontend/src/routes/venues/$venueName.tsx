import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEvents, eventListOptions } from '#/lib/hooks/useEvents'
import { useUnsaveEvent, useSaveEvent, useSavedEvents } from '#/lib/hooks/useSavedEvents'
import { EventCard } from '#/components/EventCard'
import { Pagination } from '#/components/Pagination'
import { getSavedLocation } from '#/components/LocationSearch'

const RALEIGH = { lat: 35.7796, lng: -78.6382 }
const WIDE_RADIUS = 100
const PAGE_SIZE = 20

interface VenueSearch {
  page?: number
}

export const Route = createFileRoute('/venues/$venueName')({
  validateSearch: (search: Record<string, unknown>): VenueSearch => ({
    page: search.page ? Number(search.page) : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ context, params, deps }) => {
    const loc = getSavedLocation()
    const { lat, lng } = loc ?? RALEIGH
    await context.queryClient.prefetchQuery(
      eventListOptions({
        lat,
        lng,
        radius: WIDE_RADIUS,
        venueName: decodeURIComponent(params.venueName),
        page: deps.page,
      }),
    )
  },
  component: VenuePage,
})

function VenuePage() {
  const { venueName: rawVenueName } = Route.useParams()
  const { page: searchPage } = Route.useSearch()
  const navigate = useNavigate()
  const venueName = decodeURIComponent(rawVenueName)
  const loc = getSavedLocation()
  const unsave = useUnsaveEvent()
  const save = useSaveEvent()
  const { data: savedEvents } = useSavedEvents()
  const { lat, lng } = loc ?? RALEIGH
  const page = searchPage ?? 1

  const { data, isLoading } = useEvents({
    lat,
    lng,
    radius: WIDE_RADIUS,
    venueName,
    page,
  })
  const events = data?.events ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  function goToPage(p: number) {
    navigate({
      to: '/venues/$venueName',
      params: { venueName: rawVenueName },
      search: { page: p > 1 ? p : undefined },
      replace: true,
      resetScroll: false,
    })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      <Link
        to="/events"
        className="text-sm text-[var(--lagoon-deep)] hover:text-[var(--lagoon)]"
      >
        &larr; Back to events
      </Link>

      <h1 className="text-2xl font-bold text-[var(--sea-ink)]">{venueName}</h1>

      {isLoading ? (
        <div className="py-12 text-center text-[var(--sea-ink-soft)]">
          Loading events...
        </div>
      ) : events.length === 0 ? (
        <div className="py-12 text-center text-[var(--sea-ink-soft)]">
          No upcoming events found at this venue.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            const isSaved = savedEvents?.length && savedEvents.find(savedEvent => event.ID === savedEvent.ID);
            return (
            <div key={event.ID} className="relative">
              <EventCard event={event} />
              {isSaved ? (<button
                onClick={() => unsave.mutate(event.ID)}
                disabled={unsave.isPending}
                className="absolute right-2 top-2 rounded-md bg-[var(--surface-strong)]/90 px-2 py-1 text-xs font-medium text-red-600 shadow-sm hover:bg-red-50"
              >
                Unsave
              </button>) : (<button
                onClick={() => save.mutate(event.ID)}
                disabled={save.isPending}
                className="absolute right-2 top-2 rounded-md bg-[var(--surface-strong)]/90 px-2 py-1 text-xs font-medium text-green-600 shadow-sm hover:bg-green-50"
              >
                Save
              </button>)}
            </div>
          )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
      )}
    </div>
  )
}
