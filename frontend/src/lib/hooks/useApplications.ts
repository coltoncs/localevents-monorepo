import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '#/lib/api'
import { queryKeys } from '#/lib/query-keys'
import type { AuthorApplication, SubmitApplicationInput } from '#/lib/types'

export function useMyApplication() {
  return useQuery({
    queryKey: queryKeys.applications.mine,
    queryFn: () => apiClient<AuthorApplication>('/api/me/application'),
    retry: false,
  })
}

export function useSubmitApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: SubmitApplicationInput) =>
      apiClient<AuthorApplication>('/api/author-applications', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.mine })
    },
  })
}

export function usePendingApplications() {
  return useQuery({
    queryKey: queryKeys.applications.pending,
    queryFn: () => apiClient<AuthorApplication[]>('/api/admin/applications'),
  })
}

export function useApproveApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, review_notes }: { id: string; review_notes?: string }) =>
      apiClient<AuthorApplication>(`/api/admin/applications/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ review_notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.all })
    },
  })
}

export function useRejectApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, review_notes }: { id: string; review_notes?: string }) =>
      apiClient<AuthorApplication>(`/api/admin/applications/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ review_notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.all })
    },
  })
}
