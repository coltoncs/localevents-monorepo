import {
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "#/lib/api";
import { queryKeys } from "#/lib/query-keys";
import type {
	CreateFoodInput,
	Food,
	FoodFilters,
	FoodListResponse,
} from "#/lib/types";

export function foodListOptions(filters: FoodFilters) {
	const params = new URLSearchParams({
		lat: String(filters.lat),
		lng: String(filters.lng),
	});
	if (filters.radius) params.set("radius", String(filters.radius));
	if (filters.cuisine) {
		for (const c of filters.cuisine) params.append("cuisine", c);
	}
	if (filters.minPrice) params.set("min_price", String(filters.minPrice));
	if (filters.maxPrice) params.set("max_price", String(filters.maxPrice));
	if (filters.search) params.set("search", filters.search);

	return queryOptions({
		queryKey: queryKeys.foods.list(filters),
		queryFn: () =>
			apiClient<FoodListResponse>(`/api/foods?${params.toString()}`),
	});
}

export function foodDetailOptions(id: string) {
	return queryOptions({
		queryKey: queryKeys.foods.detail(id),
		queryFn: () => apiClient<Food>(`/api/foods/${id}`),
		enabled: !!id,
	});
}

export function useFoods(filters: FoodFilters, enabled = true) {
	return useQuery({ ...foodListOptions(filters), enabled });
}

export function useFood(id: string) {
	return useQuery(foodDetailOptions(id));
}

export function useCreateFood() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: CreateFoodInput) =>
			apiClient<Food>("/api/foods", {
				method: "POST",
				body: JSON.stringify(data),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.foods.all });
		},
	});
}

export function useUpdateFood() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: CreateFoodInput }) =>
			apiClient<Food>(`/api/foods/${id}`, {
				method: "PUT",
				body: JSON.stringify(data),
			}),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.foods.all });
			queryClient.invalidateQueries({
				queryKey: queryKeys.foods.detail(variables.id),
			});
		},
	});
}

export function useDeleteFood() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) =>
			apiClient<void>(`/api/foods/${id}`, { method: "DELETE" }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.foods.all });
		},
	});
}
