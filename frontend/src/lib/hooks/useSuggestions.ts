import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '#/lib/api'
import { queryKeys } from '#/lib/query-keys'
import type { EditSuggestion, CreateEditSuggestionInput } from '#/lib/types'

export function usePendingSuggestions() {
  return useQuery({
    queryKey: queryKeys.suggestions.pending,
    queryFn: () => apiClient<EditSuggestion[]>('/api/admin/suggestions'),
  })
}

export function useMySuggestions() {
  return useQuery({
    queryKey: queryKeys.suggestions.mine,
    queryFn: () => apiClient<EditSuggestion[]>('/api/me/suggestions'),
  })
}

export function useCreateSuggestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateEditSuggestionInput) =>
      apiClient<EditSuggestion>('/api/suggestions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suggestions.all })
    },
  })
}

export function useApproveSuggestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, review_notes }: { id: string; review_notes?: string }) =>
      apiClient<EditSuggestion>(`/api/suggestions/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ review_notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suggestions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.events.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.venues.all })
    },
  })
}

export function useRejectSuggestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, review_notes }: { id: string; review_notes?: string }) =>
      apiClient<EditSuggestion>(`/api/suggestions/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ review_notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suggestions.all })
    },
  })
}
