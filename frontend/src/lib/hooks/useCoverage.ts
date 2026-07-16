import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiClient } from "#/lib/api";
import { queryKeys } from "#/lib/query-keys";

export interface CoverageCity {
	city: string;
	state: string;
	latitude: number;
	longitude: number;
	event_count: number;
}

export interface Coverage {
	cities: CoverageCity[];
	radius_miles: number;
}

// Cities we currently have events in, plus the radius the client applies around
// them. Powers the digest-signup location picker so users can only pick places
// where the weekly digest will actually have content.
export const coverageCitiesOptions = queryOptions({
	queryKey: queryKeys.coverage.cities,
	queryFn: () => apiClient<Coverage>("/api/coverage/cities"),
	// Coverage shifts slowly (new scraper cities); an hour of caching is plenty.
	staleTime: 60 * 60 * 1000,
});

export function useCoverageCities() {
	return useQuery(coverageCitiesOptions);
}
