import {
  queryOptions,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { apiClient } from '#/lib/api'
import { queryKeys } from '#/lib/query-keys'
import type { Event, EventFilters, EventListResponse, CreateEventInput } from '#/lib/types'

export function eventListOptions(filters: EventFilters) {
  const params = new URLSearchParams({
    lat: String(filters.lat),
    lng: String(filters.lng),
  })
  if (filters.radius) params.set('radius', String(filters.radius))
  if (filters.date) params.set('date', filters.date)
  if (filters.category) params.set('category', filters.category)
  if (filters.venueName) params.set('venue', filters.venueName)
  if (filters.venueId) params.set('venue_id', filters.venueId)
  if (filters.search) params.set('search', filters.search)
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.page) params.set('page', String(filters.page))

  return queryOptions({
    queryKey: queryKeys.events.list(filters),
    queryFn: () => apiClient<EventListResponse>(`/api/events?${params.toString()}`),
  })
}

export function eventDetailOptions(id: string) {
  return queryOptions({
    queryKey: queryKeys.events.detail(id),
    queryFn: () => apiClient<Event>(`/api/events/${id}`),
    enabled: !!id,
  })
}

export function useEvents(filters: EventFilters, enabled = true) {
  return useQuery({ ...eventListOptions(filters), enabled })
}

export function useEvent(id: string) {
  return useQuery(eventDetailOptions(id))
}

export function useMyEvents() {
  return useQuery({
    queryKey: queryKeys.user.myEvents,
    queryFn: () => apiClient<Event[]>('/api/me/events'),
  })
}

export function useCreateEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateEventInput) =>
      apiClient<Event>('/api/events', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.all })
    },
  })
}

export function useUpdateEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateEventInput }) =>
      apiClient<Event>(`/api/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.all })
      queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(variables.id),
      })
    },
  })
}

export function useDeleteEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<void>(`/api/events/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.all })
    },
  })
}
