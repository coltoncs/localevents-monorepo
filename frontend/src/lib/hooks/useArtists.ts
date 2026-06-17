import {
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "#/lib/api";
import { queryKeys } from "#/lib/query-keys";
import type {
	Artist,
	ArtistEventsResponse,
	ArtistListResponse,
	CreateArtistInput,
	CreateEventInput,
} from "#/lib/types";

interface ArtistFilters {
	lat: number;
	lng: number;
	radius?: number;
	genre?: string;
}

export function artistListOptions(filters: ArtistFilters) {
	const params = new URLSearchParams({
		lat: String(filters.lat),
		lng: String(filters.lng),
	});
	if (filters.radius) params.set("radius", String(filters.radius));
	if (filters.genre) params.set("genre", filters.genre);

	return queryOptions({
		queryKey: queryKeys.artists.list(filters),
		queryFn: () =>
			apiClient<ArtistListResponse>(`/api/artists?${params.toString()}`),
	});
}

export function useArtists(filters: ArtistFilters, enabled = true) {
	return useQuery({ ...artistListOptions(filters), enabled });
}

export function artistDetailOptions(id: string) {
	return queryOptions({
		queryKey: queryKeys.artists.detail(id),
		queryFn: () => apiClient<Artist>(`/api/artists/${id}`),
		enabled: !!id,
	});
}

export function useArtist(id: string) {
	return useQuery(artistDetailOptions(id));
}

export function useArtistEvents(id: string) {
	return useQuery({
		queryKey: queryKeys.artists.events(id),
		queryFn: () => apiClient<ArtistEventsResponse>(`/api/artists/${id}/events`),
		enabled: !!id,
	});
}

export function useMyArtists(enabled = true) {
	return useQuery({
		queryKey: queryKeys.artists.mine,
		queryFn: () => apiClient<Artist[]>("/api/me/artists"),
		enabled,
	});
}

export function useCreateArtist() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: CreateArtistInput) =>
			apiClient<Artist>("/api/artists", {
				method: "POST",
				body: JSON.stringify(data),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.artists.all });
		},
	});
}

export function useUpdateArtist() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: CreateArtistInput }) =>
			apiClient<Artist>(`/api/artists/${id}`, {
				method: "PUT",
				body: JSON.stringify(data),
			}),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.artists.all });
			queryClient.invalidateQueries({
				queryKey: queryKeys.artists.detail(variables.id),
			});
		},
	});
}

export function useDeleteArtist() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) =>
			apiClient<void>(`/api/artists/${id}`, { method: "DELETE" }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.artists.all });
		},
	});
}

export function useCreateArtistShow() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: CreateEventInput }) =>
			apiClient(`/api/artists/${id}/events`, {
				method: "POST",
				body: JSON.stringify(data),
			}),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.artists.events(variables.id),
			});
			queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
		},
	});
}
