import {
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "#/lib/api";
import { queryKeys } from "#/lib/query-keys";
import type {
	CreatePlaceInput,
	Place,
	PlaceFilters,
	PlaceListResponse,
} from "#/lib/types";

export function placeListOptions(filters: PlaceFilters) {
	const params = new URLSearchParams({
		lat: String(filters.lat),
		lng: String(filters.lng),
	});
	if (filters.radius) params.set("radius", String(filters.radius));
	if (filters.isFood) params.set("is_food", "true");
	if (filters.isDrink) params.set("is_drink", "true");
	if (filters.cuisine) {
		for (const c of filters.cuisine) params.append("cuisine", c);
	}
	if (filters.barType) {
		for (const t of filters.barType) params.append("bar_type", t);
	}
	if (filters.minPrice) params.set("min_price", String(filters.minPrice));
	if (filters.maxPrice) params.set("max_price", String(filters.maxPrice));
	if (filters.search) params.set("search", filters.search);

	return queryOptions({
		queryKey: queryKeys.places.list(filters),
		queryFn: () =>
			apiClient<PlaceListResponse>(`/api/places?${params.toString()}`),
	});
}

export function placeDetailOptions(id: string) {
	return queryOptions({
		queryKey: queryKeys.places.detail(id),
		queryFn: () => apiClient<Place>(`/api/places/${id}`),
		enabled: !!id,
	});
}

export function usePlaces(filters: PlaceFilters, enabled = true) {
	return useQuery({ ...placeListOptions(filters), enabled });
}

export function usePlace(id: string) {
	return useQuery(placeDetailOptions(id));
}

export function useCreatePlace() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: CreatePlaceInput) =>
			apiClient<Place>("/api/places", {
				method: "POST",
				body: JSON.stringify(data),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.places.all });
		},
	});
}

export function useUpdatePlace() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: CreatePlaceInput }) =>
			apiClient<Place>(`/api/places/${id}`, {
				method: "PUT",
				body: JSON.stringify(data),
			}),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.places.all });
			queryClient.invalidateQueries({
				queryKey: queryKeys.places.detail(variables.id),
			});
		},
	});
}

export function useDeletePlace() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) =>
			apiClient<void>(`/api/places/${id}`, { method: "DELETE" }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.places.all });
		},
	});
}
