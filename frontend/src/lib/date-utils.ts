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

/**
 * Returns true if the event has fully ended. Uses EndTime when present,
 * falling back to StartTime so events without an end still flag once started.
 * Events that cross midnight may store an end time earlier in the day than the
 * start (e.g. 12 PM – 2 AM); treat that as ending the following day so an
 * in-progress overnight event isn't flagged as past.
 */
export function isPastEvent(event: Event): boolean {
  const start = new Date(event.StartTime)
  let end = event.EndTime ? new Date(event.EndTime) : start
  if (end < start) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000)
  }
  return end < new Date()
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

export function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

export function formatTimeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatEventTime(event: Event): string {
  if (isAllDay(event)) {
    return formatDateOnly(event.StartTime) + ' · All Day'
  }
  return formatDate(event.StartTime)
}
