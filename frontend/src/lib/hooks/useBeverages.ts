import {
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "#/lib/api";
import { queryKeys } from "#/lib/query-keys";
import type {
	Beverage,
	BeverageFilters,
	BeverageListResponse,
	CreateBeverageInput,
} from "#/lib/types";

export function beverageListOptions(filters: BeverageFilters) {
	const params = new URLSearchParams({
		lat: String(filters.lat),
		lng: String(filters.lng),
	});
	if (filters.radius) params.set("radius", String(filters.radius));
	if (filters.type) params.set("type", filters.type);

	return queryOptions({
		queryKey: queryKeys.beverages.list(filters),
		queryFn: () =>
			apiClient<BeverageListResponse>(`/api/beverages?${params.toString()}`),
	});
}

export function beverageDetailOptions(id: string) {
	return queryOptions({
		queryKey: queryKeys.beverages.detail(id),
		queryFn: () => apiClient<Beverage>(`/api/beverages/${id}`),
		enabled: !!id,
	});
}

export function useBeverages(filters: BeverageFilters, enabled = true) {
	return useQuery({ ...beverageListOptions(filters), enabled });
}

export function useBeverage(id: string) {
	return useQuery(beverageDetailOptions(id));
}

export function useCreateBeverage() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: CreateBeverageInput) =>
			apiClient<Beverage>("/api/beverages", {
				method: "POST",
				body: JSON.stringify(data),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.beverages.all });
		},
	});
}

export function useUpdateBeverage() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: CreateBeverageInput }) =>
			apiClient<Beverage>(`/api/beverages/${id}`, {
				method: "PUT",
				body: JSON.stringify(data),
			}),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.beverages.all });
			queryClient.invalidateQueries({
				queryKey: queryKeys.beverages.detail(variables.id),
			});
		},
	});
}

export function useDeleteBeverage() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) =>
			apiClient<void>(`/api/beverages/${id}`, { method: "DELETE" }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.beverages.all });
		},
	});
}
