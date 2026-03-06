import { Link } from '@tanstack/react-router'
import type { Event } from '#/lib/types'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatPrice(event: Event) {
  if (event.PriceMin == null && event.PriceMax == null) return 'Free'
  if (event.PriceMin != null && event.PriceMax != null) {
    if (event.PriceMin === event.PriceMax) return `$${event.PriceMin}`
    return `$${event.PriceMin} - $${event.PriceMax}`
  }
  return `$${event.PriceMin ?? event.PriceMax}`
}

export function EventCard({ event }: { event: Event }) {
  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: event.ID }}
      className="block rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-4 shadow-sm transition hover:shadow-md"
    >
      {event.ImageUrl && (
        <img
          src={event.ImageUrl}
          alt={event.Title}
          className="mb-3 h-40 w-full rounded-md object-cover"
        />
      )}
      <div className="space-y-1">
        {event.Category && (
          <span className="inline-block rounded-full bg-[rgba(79,184,178,0.14)] px-2 py-0.5 text-xs font-medium text-[var(--lagoon-deep)]">
            {event.Category}
          </span>
        )}
        <h3 className="font-semibold text-[var(--sea-ink)]">{event.Title}</h3>
        <p className="text-sm text-[var(--sea-ink-soft)]">{formatDate(event.StartTime)}</p>
        {event.VenueName && (
          <p className="text-sm text-[var(--sea-ink-soft)]">
            <Link
              to="/venues/$venueName"
              params={{ venueName: event.VenueName }}
              className="hover:text-[var(--lagoon-deep)] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {event.VenueName}
            </Link>
          </p>
        )}
        <p className="text-sm font-medium text-[var(--sea-ink)]">
          {formatPrice(event)}
        </p>
      </div>
    </Link>
  )
}
