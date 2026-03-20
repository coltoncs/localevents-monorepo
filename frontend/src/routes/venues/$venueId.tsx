import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEvents, eventListOptions } from '#/lib/hooks/useEvents'
import { useVenue, venueDetailOptions } from '#/lib/hooks/useVenues'
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

export const Route = createFileRoute('/venues/$venueId')({
  validateSearch: (search: Record<string, unknown>): VenueSearch => ({
    page: search.page ? Number(search.page) : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ context, params, deps }) => {
    const loc = getSavedLocation()
    const { lat, lng } = loc ?? RALEIGH
    await Promise.all([
      context.queryClient.prefetchQuery(venueDetailOptions(params.venueId)),
      context.queryClient.prefetchQuery(
        eventListOptions({
          lat,
          lng,
          radius: WIDE_RADIUS,
          venueId: params.venueId,
          page: deps.page,
        }),
      ),
    ])
  },
  component: VenuePage,
})

function VenuePage() {
  const { venueId } = Route.useParams()
  const { page: searchPage } = Route.useSearch()
  const navigate = useNavigate()
  const loc = getSavedLocation()
  const unsave = useUnsaveEvent()
  const save = useSaveEvent()
  const { data: savedEvents } = useSavedEvents()
  const { lat, lng } = loc ?? RALEIGH
  const page = searchPage ?? 1

  const { data: venue, isLoading: venueLoading } = useVenue(venueId)
  const { data, isLoading: eventsLoading } = useEvents({
    lat,
    lng,
    radius: WIDE_RADIUS,
    venueId,
    page,
  })
  const events = data?.events ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const isLoading = venueLoading || eventsLoading

  function goToPage(p: number) {
    navigate({
      to: '/venues/$venueId',
      params: { venueId },
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

      <div>
        <h1 className="text-2xl font-bold text-[var(--sea-ink)]">
          {venue?.VenueName ?? 'Venue'}
        </h1>
        {venue && (
          <div className="mt-1 space-y-1 text-sm text-[var(--sea-ink-soft)]">
            {(venue.Address || venue.City) && (
              <p>
                {[venue.Address, venue.City, venue.State, venue.Zip]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
            {venue.Hours && <p>Hours: {venue.Hours}</p>}
            {venue.Description && <p className="mt-2">{venue.Description}</p>}
          </div>
        )}
      </div>

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
