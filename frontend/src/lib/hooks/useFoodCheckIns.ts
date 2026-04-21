import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "#/lib/api";
import { queryKeys } from "#/lib/query-keys";
import type { MyFoodCheckInsResponse } from "#/lib/types";

export interface CheckInCounts {
	total: number;
	unique: number;
}

export function useMyFoodCheckIns() {
	return useQuery({
		queryKey: queryKeys.foodCheckIns.mine,
		queryFn: () => apiClient<MyFoodCheckInsResponse>("/api/me/food-checkins"),
	});
}

export function useFoodCheckInCounts(foodId: string) {
	return useQuery({
		queryKey: queryKeys.foodCheckIns.counts(foodId),
		queryFn: () =>
			apiClient<CheckInCounts>(`/api/foods/${foodId}/checkin-counts`),
	});
}

export function useMyFoodCheckInStatus(foodId: string, enabled: boolean) {
	return useQuery({
		queryKey: queryKeys.foodCheckIns.myStatus(foodId),
		queryFn: () =>
			apiClient<{ checkedInToday: boolean }>(
				`/api/foods/${foodId}/my-checkin-status`,
			),
		enabled,
	});
}

export function useFoodCheckIn(foodId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (coords: { latitude: number; longitude: number }) =>
			apiClient(`/api/foods/${foodId}/checkins`, {
				method: "POST",
				body: JSON.stringify(coords),
			}),
		onSuccess: () => {
			qc.invalidateQueries({
				queryKey: queryKeys.foodCheckIns.counts(foodId),
			});
			qc.invalidateQueries({
				queryKey: queryKeys.foodCheckIns.myStatus(foodId),
			});
			qc.invalidateQueries({
				queryKey: queryKeys.foodCheckIns.mine,
			});
		},
	});
}
