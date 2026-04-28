import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "#/lib/api";
import { queryKeys } from "#/lib/query-keys";
import type { MyPlaceCheckInsResponse } from "#/lib/types";

export interface CheckInCounts {
	total: number;
	unique: number;
}

export function useMyPlaceCheckIns() {
	return useQuery({
		queryKey: queryKeys.placeCheckIns.mine,
		queryFn: () => apiClient<MyPlaceCheckInsResponse>("/api/me/place-checkins"),
	});
}

export function usePlaceCheckInCounts(placeId: string) {
	return useQuery({
		queryKey: queryKeys.placeCheckIns.counts(placeId),
		queryFn: () =>
			apiClient<CheckInCounts>(`/api/places/${placeId}/checkin-counts`),
	});
}

export function useMyPlaceCheckInStatus(placeId: string, enabled: boolean) {
	return useQuery({
		queryKey: queryKeys.placeCheckIns.myStatus(placeId),
		queryFn: () =>
			apiClient<{ checkedInToday: boolean }>(
				`/api/places/${placeId}/my-checkin-status`,
			),
		enabled,
	});
}

export function usePlaceCheckIn(placeId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (coords: { latitude: number; longitude: number }) =>
			apiClient(`/api/places/${placeId}/checkins`, {
				method: "POST",
				body: JSON.stringify(coords),
			}),
		onSuccess: () => {
			qc.invalidateQueries({
				queryKey: queryKeys.placeCheckIns.counts(placeId),
			});
			qc.invalidateQueries({
				queryKey: queryKeys.placeCheckIns.myStatus(placeId),
			});
			qc.invalidateQueries({
				queryKey: queryKeys.placeCheckIns.mine,
			});
		},
	});
}
