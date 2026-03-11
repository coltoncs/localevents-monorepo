import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '#/lib/api'
import { queryKeys } from '#/lib/query-keys'
import type { UserImage, PresignResponse } from '#/lib/types'

export function useImages() {
  return useQuery({
    queryKey: queryKeys.images.list,
    queryFn: () => apiClient<UserImage[]>('/api/images'),
  })
}

export function useUploadImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File): Promise<UserImage> => {
      // 1. Get presigned URL from backend
      const presign = await apiClient<PresignResponse>('/api/images/presign', {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          content_type: file.type,
        }),
      })

      // 2. Upload directly to R2
      const uploadRes = await fetch(presign.upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!uploadRes.ok) {
        throw new Error('Failed to upload image to storage')
      }

      // 3. Confirm upload with backend (saves DB record)
      return apiClient<UserImage>('/api/images/confirm', {
        method: 'POST',
        body: JSON.stringify({
          key: presign.key,
          filename: file.name,
          content_type: file.type,
          size_bytes: file.size,
        }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.images.all })
    },
  })
}

export function useDeleteImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<void>(`/api/images/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.images.all })
    },
  })
}
