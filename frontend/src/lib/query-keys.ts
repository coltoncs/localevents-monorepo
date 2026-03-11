import type { EventFilters } from './types'

interface VenueFilters {
  lat: number
  lng: number
  radius?: number
}

export const queryKeys = {
  events: {
    all: ['events'] as const,
    list: (filters: EventFilters) => ['events', 'list', filters] as const,
    detail: (id: string) => ['events', 'detail', id] as const,
  },
  venues: {
    all: ['venues'] as const,
    list: (filters: VenueFilters) => ['venues', 'list', filters] as const,
  },
  user: {
    me: ['user', 'me'] as const,
    myEvents: ['user', 'myEvents'] as const,
  },
  savedEvents: {
    all: ['savedEvents'] as const,
    list: ['savedEvents', 'list'] as const,
    check: (eventId: string) => ['savedEvents', 'check', eventId] as const,
  },
  applications: {
    all: ['applications'] as const,
    pending: ['applications', 'pending'] as const,
    mine: ['applications', 'mine'] as const,
  },
  images: {
    all: ['images'] as const,
    list: ['images', 'list'] as const,
  },
}
