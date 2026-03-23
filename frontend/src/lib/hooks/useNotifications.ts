import {
  queryOptions,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { apiClient } from '#/lib/api'
import { queryKeys } from '#/lib/query-keys'
import type { NotificationPreferences, UpdateNotificationInput } from '#/lib/types'

export const notificationPreferencesOptions = queryOptions({
  queryKey: queryKeys.notifications.preferences,
  queryFn: () => apiClient<NotificationPreferences>('/api/me/notifications'),
})

export function useNotificationPreferences() {
  return useQuery(notificationPreferencesOptions)
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateNotificationInput) =>
      apiClient<NotificationPreferences>('/api/me/notifications', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.notifications.preferences, data)
    },
  })
}
