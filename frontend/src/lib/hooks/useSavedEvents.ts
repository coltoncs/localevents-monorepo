import {
  queryOptions,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { apiClient } from '#/lib/api'
import { queryKeys } from '#/lib/query-keys'
import type { Event, SavedEvent } from '#/lib/types'

export const savedEventsOptions = queryOptions({
  queryKey: queryKeys.savedEvents.list,
  queryFn: () => apiClient<Event[]>('/api/me/saved'),
})

export function useSavedEvents() {
  return useQuery(savedEventsOptions)
}

export function useSaveEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (eventId: string) =>
      apiClient<SavedEvent>(`/api/me/saved/${eventId}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedEvents.all })
    },
  })
}

export function useUnsaveEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (eventId: string) =>
      apiClient<void>(`/api/me/saved/${eventId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedEvents.all })
    },
  })
}
