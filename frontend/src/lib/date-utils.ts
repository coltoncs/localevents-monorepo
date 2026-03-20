import type { Event } from './types'

/**
 * Returns true if the event spans from midnight to 11:59 PM on the same day,
 * which scrapers typically use to represent "all day" events.
 */
export function isAllDay(event: Event): boolean {
  if (!event.EndTime) return false
  const start = new Date(event.StartTime)
  const end = new Date(event.EndTime)
  return (
    start.getHours() === 0 &&
    start.getMinutes() === 0 &&
    end.getHours() === 23 &&
    end.getMinutes() === 59 &&
    start.toDateString() === end.toDateString()
  )
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDateOnly(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function formatEventTime(event: Event): string {
  if (isAllDay(event)) {
    return formatDateOnly(event.StartTime) + ' · All Day'
  }
  return formatDate(event.StartTime)
}
