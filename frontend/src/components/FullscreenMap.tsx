import { useState, useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { Map as MapboxMap } from 'mapbox-gl'
import { EventMap } from '#/components/EventMap'
import { useEvents } from '#/lib/hooks/useEvents'
import { isAllDay } from '#/lib/date-utils'
import type { Event } from '#/lib/types'

const CATEGORIES = [
  'Music',
  'Sports',
  'Arts',
  'Food',
  'Tech',
  'Community',
  'Outdoors',
  'Nightlife',
]

interface FullscreenMapProps {
  lat: number
  lng: number
  radius?: number
  date?: string
  category?: string
  onClose: () => void
}

export function FullscreenMap({
  lat,
  lng,
  radius,
  date,
  category,
  onClose,
}: FullscreenMapProps) {
  const navigate = useNavigate()
  const [listOpen, setListOpen] = useState(false)
  const mapInstanceRef = useRef<MapboxMap | null>(null)

  // Lock body scroll while fullscreen is active
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const filters = { lat, lng, radius, date, category }
  const shouldFetch = !!date
  const { data } = useEvents(filters, shouldFetch)
  const events = shouldFetch ? (data?.events ?? []) : []

  function updateSearch(updates: Record<string, string | undefined>) {
    navigate({
      to: '/events',
      search: (prev) => ({ ...prev, lat, lng, view: 'map' as const, ...updates }),
      replace: true,
    })
  }

  function shiftDate(days: number) {
    const base = date ? new Date(date + 'T00:00:00') : new Date()
    base.setDate(base.getDate() + days)
    const yyyy = base.getFullYear()
    const mm = String(base.getMonth() + 1).padStart(2, '0')
    const dd = String(base.getDate()).padStart(2, '0')
    updateSearch({ date: `${yyyy}-${mm}-${dd}` })
  }

  function formatDateLabel(iso: string) {
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <div className="fixed inset-0 z-[60] h-[100dvh] bg-[var(--bg-base)]">
      <EventMap
        events={events}
        center={{ lat, lng }}
        radiusMiles={radius ?? 25}
        className="h-full w-full"
        onMapReady={(map) => { mapInstanceRef.current = map }}
      />

      {/* Control layer — pointer-events-none so map stays interactive */}
      <div className="absolute inset-0 pointer-events-none flex flex-col">
        {/* Top bar */}
        <div className="flex items-start justify-between p-3 gap-2">
          {/* Filters */}
          <div className="pointer-events-auto flex max-w-[70%] flex-col gap-2 sm:max-w-none sm:flex-row">
            {/* Date navigation: prev / label+picker / next */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => shiftDate(-1)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] backdrop-blur-lg text-[var(--sea-ink)] shadow-lg hover:bg-[var(--surface)] cursor-pointer"
                aria-label="Previous day"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M8 3L4 7l4 4" />
                </svg>
              </button>
              <label className="relative">
                <span className="flex h-9 min-w-[7rem] cursor-pointer items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] backdrop-blur-lg px-3 text-sm font-medium text-[var(--sea-ink)] shadow-lg">
                  {date ? formatDateLabel(date) : 'Pick date'}
                </span>
                <input
                  type="date"
                  value={date ?? ''}
                  onChange={(e) => updateSearch({ date: e.target.value || undefined })}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
              <button
                onClick={() => shiftDate(1)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] backdrop-blur-lg text-[var(--sea-ink)] shadow-lg hover:bg-[var(--surface)] cursor-pointer"
                aria-label="Next day"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 3l4 4-4 4" />
                </svg>
              </button>
            </div>
            <select
              value={category ?? ''}
              onChange={(e) => updateSearch({ category: e.target.value || undefined })}
              className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] backdrop-blur-lg px-3 py-2 text-sm text-[var(--sea-ink)] shadow-lg"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] backdrop-blur-lg text-[var(--sea-ink)] shadow-lg hover:bg-[var(--surface)] cursor-pointer"
            aria-label="Exit fullscreen"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M15 5L5 15M5 5l10 10" />
            </svg>
          </button>
        </div>

        {/* Spacer pushes event list to bottom */}
        <div className="flex-1" />

        {/* Bottom event list panel — mb-8 clears Mapbox attribution */}
        <div className="pointer-events-auto mb-8 sm:mb-3">
          <button
            onClick={() => setListOpen(!listOpen)}
            className="mx-3 mb-1 flex items-center gap-2 rounded-t-lg border border-b-0 border-[var(--line)] bg-[var(--surface-strong)] backdrop-blur-lg px-4 py-2 text-sm font-medium text-[var(--sea-ink)] shadow-lg cursor-pointer"
          >
            <span>{shouldFetch ? `${events.length} event${events.length !== 1 ? 's' : ''}` : 'Select a date'}</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className={`transition-transform ${listOpen ? 'rotate-180' : ''}`}
            >
              <path d="M2 8l4-4 4 4" />
            </svg>
          </button>

          {listOpen && (
            <div className="fullscreen-slide-up mx-3 mb-3 max-h-[40vh] overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] backdrop-blur-lg shadow-lg">
              {!shouldFetch ? (
                <div className="px-4 py-6 text-center text-sm text-[var(--sea-ink-soft)]">
                  Select a date above to see events
                </div>
              ) : events.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-[var(--sea-ink-soft)]">
                  No events found
                </div>
              ) : (
                events.map((event) => (
                  <EventRow key={event.ID} event={event} map={mapInstanceRef.current} />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EventRow({ event, map }: { event: Event; map: MapboxMap | null }) {
  const time = isAllDay(event)
    ? 'All Day'
    : new Date(event.StartTime).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })

  function handleClick() {
    map?.flyTo({
      center: [event.Longitude, event.Latitude],
      zoom: 15,
      duration: 1200,
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full cursor-pointer items-center gap-3 border-b border-[var(--line)] px-4 py-3 text-left text-[var(--sea-ink)] hover:bg-[var(--surface)] last:border-b-0"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{event.Title}</div>
        <div className="truncate text-xs text-[var(--sea-ink-soft)]">
          {time}{event.VenueName ? ` · ${event.VenueName}` : ''}{event.City ? `, ${event.City}` : ''}
        </div>
      </div>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0 text-[var(--sea-ink-soft)]">
        <path d="M3 8h10M10 5l3 3-3 3" />
      </svg>
    </button>
  )
}
