import { createFileRoute, Link } from '@tanstack/react-router'
import { useEvents, eventListOptions } from '#/lib/hooks/useEvents'
import { EventCard } from '#/components/EventCard'
import { getSavedLocation } from '#/components/LocationSearch'

const RALEIGH = { lat: 35.7796, lng: -78.6382 }
const WIDE_RADIUS = 100

export const Route = createFileRoute('/venues/$venueName')({
  loader: async ({ context, params }) => {
    const loc = getSavedLocation()
    const { lat, lng } = loc ?? RALEIGH
    await context.queryClient.prefetchQuery(
      eventListOptions({
        lat,
        lng,
        radius: WIDE_RADIUS,
        venueName: decodeURIComponent(params.venueName),
      }),
    )
  },
  component: VenuePage,
})

function VenuePage() {
  const { venueName: rawVenueName } = Route.useParams()
  const venueName = decodeURIComponent(rawVenueName)
  const loc = getSavedLocation()
  const { lat, lng } = loc ?? RALEIGH

  const { data, isLoading } = useEvents({
    lat,
    lng,
    radius: WIDE_RADIUS,
    venueName,
  })
  const events = data?.events ?? []

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
          {events.map((event) => (
            <EventCard key={event.ID} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}
