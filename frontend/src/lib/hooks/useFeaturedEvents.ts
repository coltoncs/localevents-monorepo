import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "#/lib/api";
import { queryKeys } from "#/lib/query-keys";
import type {
	Event,
	FeatureQuota,
	FeaturedEventsFilters,
	FeaturedEventsResponse,
} from "#/lib/types";

export function useFeaturedEvents(
	filters: FeaturedEventsFilters,
	enabled = true,
) {
	const params = new URLSearchParams({
		lat: String(filters.lat),
		lng: String(filters.lng),
	});
	if (filters.radius) params.set("radius", String(filters.radius));
	if (filters.limit) params.set("limit", String(filters.limit));

	return useQuery({
		queryKey: queryKeys.events.featured(filters),
		queryFn: () =>
			apiClient<FeaturedEventsResponse>(
				`/api/events/featured?${params.toString()}`,
			),
		enabled,
	});
}

// How many events the current user has featured this month, and how many
// remain before hitting the monthly cap. Admins are uncapped (unlimited=true).
export function useFeatureQuota(enabled = true) {
	return useQuery({
		queryKey: queryKeys.user.featureQuota,
		queryFn: () => apiClient<FeatureQuota>("/api/me/feature-quota"),
		enabled,
	});
}

// The events the current user currently has featured (across any event, not
// just ones they submitted).
export function useMyFeaturedEvents(enabled = true) {
	return useQuery({
		queryKey: queryKeys.user.myFeatured,
		queryFn: () => apiClient<Event[]>("/api/me/featured-events"),
		enabled,
	});
}

// Mark/unmark an event as featured. Author/admin only (enforced server-side).
export function useSetFeatured() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, featured }: { id: string; featured: boolean }) =>
			apiClient<Event>(`/api/events/${id}/feature`, {
				method: featured ? "POST" : "DELETE",
			}),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
			queryClient.invalidateQueries({
				queryKey: queryKeys.events.detail(variables.id),
			});
			queryClient.invalidateQueries({
				queryKey: queryKeys.user.featureQuota,
			});
			queryClient.invalidateQueries({
				queryKey: queryKeys.user.myFeatured,
			});
		},
	});
}
