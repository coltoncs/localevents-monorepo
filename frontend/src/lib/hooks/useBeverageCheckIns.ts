import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "#/lib/api";
import { queryKeys } from "#/lib/query-keys";

export interface CheckInCounts {
	total: number;
	unique: number;
}

export function useBeverageCheckInCounts(beverageId: string) {
	return useQuery({
		queryKey: queryKeys.beverageCheckIns.counts(beverageId),
		queryFn: () =>
			apiClient<CheckInCounts>(`/api/beverages/${beverageId}/checkin-counts`),
	});
}

export function useMyCheckInStatus(beverageId: string, enabled: boolean) {
	return useQuery({
		queryKey: queryKeys.beverageCheckIns.myStatus(beverageId),
		queryFn: () =>
			apiClient<{ checkedInToday: boolean }>(
				`/api/beverages/${beverageId}/my-checkin-status`,
			),
		enabled,
	});
}

export function useCheckIn(beverageId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (coords: { latitude: number; longitude: number }) =>
			apiClient(`/api/beverages/${beverageId}/checkins`, {
				method: "POST",
				body: JSON.stringify(coords),
			}),
		onSuccess: () => {
			qc.invalidateQueries({
				queryKey: queryKeys.beverageCheckIns.counts(beverageId),
			});
			qc.invalidateQueries({
				queryKey: queryKeys.beverageCheckIns.myStatus(beverageId),
			});
		},
	});
}
