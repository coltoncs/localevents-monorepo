import {
  queryOptions,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { apiClient } from '#/lib/api'
import { queryKeys } from '#/lib/query-keys'
import type { User, UpdateUserInput } from '#/lib/types'

export const userOptions = queryOptions({
  queryKey: queryKeys.user.me,
  queryFn: () => apiClient<User>('/api/me'),
})

export function useUser() {
  return useQuery(userOptions)
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateUserInput) =>
      apiClient<User>('/api/me', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.user.me, data)
    },
  })
}
