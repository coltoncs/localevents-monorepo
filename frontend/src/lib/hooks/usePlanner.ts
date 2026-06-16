import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "#/lib/api";
import { queryKeys } from "#/lib/query-keys";
import type {
	CreateSharedPlanResponse,
	PlannerResponse,
	WeeklyPlan,
} from "#/lib/types";

// usePlanner fetches the signed-in user's latest persisted itinerary. Plans are
// generated weekly alongside the digest (and overwritten by an on-demand
// recalculation); status="none" means no plan exists yet.
export function usePlanner() {
	return useQuery({
		queryKey: queryKeys.planner.latest,
		queryFn: () => apiClient<PlannerResponse>("/api/me/planner"),
		staleTime: 5 * 60 * 1000,
	});
}

export interface PlannerComputeArgs {
	lat: number;
	lng: number;
	radius?: number;
	categories?: string[];
}

// usePlannerCompute builds an itinerary on demand. Open to everyone: anonymous
// callers get a transient plan; signed-in callers get a personalized plan that
// also overwrites their stored weekly plan.
export function usePlannerCompute() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (args: PlannerComputeArgs) => {
			const params = new URLSearchParams();
			params.set("lat", String(args.lat));
			params.set("lng", String(args.lng));
			if (args.radius != null) params.set("radius", String(args.radius));
			if (args.categories?.length)
				params.set("categories", args.categories.join(","));
			return apiClient<PlannerResponse>(
				`/api/planner/compute?${params.toString()}`,
			);
		},
		onSuccess: () => {
			// A signed-in recalc overwrites the stored plan — refresh it.
			queryClient.invalidateQueries({ queryKey: queryKeys.planner.all });
		},
	});
}

// useCreateSharedPlan persists a snapshot of an itinerary and returns a token
// used to build a public share link (/plan/{token}).
export function useCreateSharedPlan() {
	return useMutation({
		mutationFn: (plan: WeeklyPlan) =>
			apiClient<CreateSharedPlanResponse>("/api/planner/share", {
				method: "POST",
				body: JSON.stringify(plan),
			}),
	});
}

// useSharedPlan reads a shared itinerary snapshot by token. Snapshots are
// immutable, so the result never goes stale.
export function useSharedPlan(token: string) {
	return useQuery({
		queryKey: queryKeys.planner.shared(token),
		queryFn: () => apiClient<PlannerResponse>(`/api/planner/shared/${token}`),
		enabled: !!token,
		staleTime: Number.POSITIVE_INFINITY,
	});
}
