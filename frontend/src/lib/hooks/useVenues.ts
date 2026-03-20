import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '#/lib/api'
import { queryKeys } from '#/lib/query-keys'
import type { Venue, VenueListResponse, UpdateVenueInput } from '#/lib/types'

interface VenueFilters {
  lat: number
  lng: number
  radius?: number
}

export function venueListOptions(filters: VenueFilters) {
  const params = new URLSearchParams({
    lat: String(filters.lat),
    lng: String(filters.lng),
  })
  if (filters.radius) params.set('radius', String(filters.radius))

  return queryOptions({
    queryKey: queryKeys.venues.list(filters),
    queryFn: () =>
      apiClient<VenueListResponse>(`/api/venues?${params.toString()}`),
  })
}

export function venueDetailOptions(id: string) {
  return queryOptions({
    queryKey: queryKeys.venues.detail(id),
    queryFn: () => apiClient<Venue>(`/api/venues/${id}`),
    enabled: !!id,
  })
}

export function useVenues(filters: VenueFilters, enabled = true) {
  return useQuery({ ...venueListOptions(filters), enabled })
}

export function useVenue(id: string) {
  return useQuery(venueDetailOptions(id))
}

export function useUpdateVenue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateVenueInput }) =>
      apiClient<Venue>(`/api/venues/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.venues.all })
      queryClient.invalidateQueries({
        queryKey: queryKeys.venues.detail(variables.id),
      })
    },
  })
}
