import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "#/lib/api";
import { queryKeys } from "#/lib/query-keys";
import type { Event } from "#/lib/types";

export interface RecommendationsResponse {
	status: "ready" | "learning";
	signal_count: number;
	saves_remaining: number;
	events: Event[];
}

export interface UseRecommendationsArgs {
	lat?: number;
	lng?: number;
	radius?: number;
	limit?: number;
}

export function useRecommendations({
	lat,
	lng,
	radius,
	limit,
}: UseRecommendationsArgs) {
	return useQuery({
		queryKey: queryKeys.recommendations.list(lat ?? 0, lng ?? 0, radius),
		queryFn: () => {
			const params = new URLSearchParams();
			if (lat != null) params.set("lat", String(lat));
			if (lng != null) params.set("lng", String(lng));
			if (radius != null) params.set("radius", String(radius));
			if (limit != null) params.set("limit", String(limit));
			return apiClient<RecommendationsResponse>(
				`/api/me/recommendations?${params.toString()}`,
			);
		},
		enabled: lat != null && lng != null,
		staleTime: 5 * 60 * 1000,
	});
}

// Recording a card impression. Fire-and-forget — failure doesn't matter.
export function useRecordEventView() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (eventId: string) =>
			apiClient<void>(`/api/me/event-views/${eventId}`, { method: "POST" }),
		onSuccess: () => {
			// View counts toward signal — invalidate so cold-start state can flip.
			queryClient.invalidateQueries({
				queryKey: queryKeys.recommendations.all,
			});
		},
	});
}
