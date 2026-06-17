import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "#/lib/api";
import { queryKeys } from "#/lib/query-keys";
import type { SubmitVenueClaimInput, VenueClaim } from "#/lib/types";

export function useMyVenueClaims() {
	return useQuery({
		queryKey: queryKeys.venueClaims.mine,
		queryFn: () => apiClient<VenueClaim[]>("/api/me/venue-claims"),
		retry: false,
	});
}

export function useSubmitVenueClaim() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: SubmitVenueClaimInput) =>
			apiClient<VenueClaim>("/api/venue-claims", {
				method: "POST",
				body: JSON.stringify(data),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.venueClaims.mine });
		},
	});
}

export function usePendingVenueClaims() {
	return useQuery({
		queryKey: queryKeys.venueClaims.pending,
		queryFn: () => apiClient<VenueClaim[]>("/api/admin/venue-claims"),
	});
}

export function useApproveVenueClaim() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, review_notes }: { id: string; review_notes?: string }) =>
			apiClient<VenueClaim>(`/api/admin/venue-claims/${id}/approve`, {
				method: "POST",
				body: JSON.stringify({ review_notes }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.venueClaims.all });
			queryClient.invalidateQueries({ queryKey: queryKeys.venues.all });
		},
	});
}

export function useRejectVenueClaim() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, review_notes }: { id: string; review_notes?: string }) =>
			apiClient<VenueClaim>(`/api/admin/venue-claims/${id}/reject`, {
				method: "POST",
				body: JSON.stringify({ review_notes }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.venueClaims.all });
		},
	});
}
