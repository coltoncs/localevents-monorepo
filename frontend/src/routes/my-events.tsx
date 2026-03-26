import { createFileRoute, Link } from '@tanstack/react-router'
import { RoleProtectedRoute } from '#/components/RoleProtectedRoute'
import { useMyEvents } from '#/lib/hooks/useEvents'
import { EventCard } from '#/components/EventCard'
import { Spinner } from '#/components/Spinner'

export const Route = createFileRoute('/my-events')({
  component: MyEventsPage,
})

function MyEventsPage() {
  return (
    <RoleProtectedRoute roles={['author', 'admin']}>
      <MyEventsContent />
    </RoleProtectedRoute>
  )
}

function MyEventsContent() {
  const { data: events = [], isLoading } = useMyEvents()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-(--sea-ink)">My Submitted Events</h1>
        <Link
          to="/submit"
          className="rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-semibold text-white! no-underline shadow-sm hover:bg-(--lagoon)"
        >
          Submit Event
        </Link>
      </div>

      {isLoading ? (
        <Spinner className="py-12" />
      ) : events.length === 0 ? (
        <div className="py-12 text-center text-(--sea-ink-soft)">
          You haven't submitted any events yet.
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
