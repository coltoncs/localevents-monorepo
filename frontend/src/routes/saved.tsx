import { createFileRoute } from '@tanstack/react-router'
import { ProtectedRoute } from '#/components/ProtectedRoute'
import { useSavedEvents, useUnsaveEvent } from '#/lib/hooks/useSavedEvents'
import { EventCard } from '#/components/EventCard'
import { Spinner } from '#/components/Spinner'

export const Route = createFileRoute('/saved')({
  component: SavedPage,
})

function SavedPage() {
  return (
    <ProtectedRoute>
      <SavedContent />
    </ProtectedRoute>
  )
}

function SavedContent() {
  const { data: events = [], isLoading } = useSavedEvents()
  const unsave = useUnsaveEvent()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-(--sea-ink)">Saved Events</h1>

      {isLoading ? (
        <Spinner className="py-12" />
      ) : events.length === 0 ? (
        <div className="py-12 text-center text-(--sea-ink-soft)">
          No saved events yet. Browse events and save ones you&apos;re
          interested in!
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <div key={event.ID} className="relative">
              <EventCard event={event} />
              <button
                onClick={() => unsave.mutate(event.ID)}
                disabled={unsave.isPending}
                className="absolute right-2 top-2 rounded-md bg-(--surface-strong)/90 px-2 py-1 text-xs font-medium text-red-600 shadow-sm hover:bg-red-50"
              >
                Unsave
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
