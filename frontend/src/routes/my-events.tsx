import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { RoleProtectedRoute } from '#/components/RoleProtectedRoute'
import { useMyEvents } from '#/lib/hooks/useEvents'
import { useMySuggestions } from '#/lib/hooks/useSuggestions'
import { EventCard } from '#/components/EventCard'
import { EventTable } from '#/components/EventTable'
import { SuggestionCard } from '#/components/SuggestionCard'
import { ViewToggle } from '#/components/ViewToggle'
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
  const { data: suggestions = [], isLoading: suggestionsLoading } = useMySuggestions()
  const [displayMode, setDisplayMode] = useState<'cards' | 'list'>('cards')

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-(--sea-ink)">My Submitted Events</h1>
        <div className="flex items-center gap-3">
          <ViewToggle view={displayMode} onChange={setDisplayMode} />
          <Link
            to="/submit"
            className="rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-semibold text-white! no-underline shadow-sm hover:bg-(--lagoon)"
          >
            Submit Event
          </Link>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-bold text-(--sea-ink)">
            Pending Edit Suggestions
          </h2>
          <div className="max-w-3xl space-y-4">
            {suggestions.map((s) => (
              <SuggestionCard key={s.ID} suggestion={s} />
            ))}
          </div>
        </div>
      )}

      {suggestionsLoading && <Spinner className="py-4" />}

      {isLoading ? (
        <Spinner className="py-12" />
      ) : events.length === 0 ? (
        <div className="py-12 text-center text-(--sea-ink-soft)">
          You haven't submitted any events yet.
        </div>
      ) : (
        displayMode === 'cards' ? (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {events.map((event) => (
              <div key={event.ID} className="mb-4 break-inside-avoid">
                <EventCard event={event} />
              </div>
            ))}
          </div>
        ) : (
          <EventTable events={events} />
        )
      )}
    </div>
  )
}
