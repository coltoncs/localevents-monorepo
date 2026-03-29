import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ProtectedRoute } from '#/components/ProtectedRoute'
import { useSavedEvents, useUnsaveEvent } from '#/lib/hooks/useSavedEvents'
import { EventCard } from '#/components/EventCard'
import { EventTable } from '#/components/EventTable'
import { ViewToggle } from '#/components/ViewToggle'
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
  const [displayMode, setDisplayMode] = useState<'cards' | 'list'>('cards')

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-(--sea-ink)">Saved Events</h1>
        <ViewToggle view={displayMode} onChange={setDisplayMode} />
      </div>

      {isLoading ? (
        <Spinner className="py-12" />
      ) : events.length === 0 ? (
        <div className="py-12 text-center text-(--sea-ink-soft)">
          No saved events yet. Browse events and save ones you&apos;re
          interested in!
        </div>
      ) : (
        displayMode === 'cards' ? (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {events.map((event) => (
              <div key={event.ID} className="relative mb-4 break-inside-avoid">
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
        ) : (
          <EventTable events={events} />
        )
      )}
    </div>
  )
}
