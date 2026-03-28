import { useQuery } from "@tanstack/react-query";
import { apiClient } from "#/lib/api";
import { queryKeys } from "#/lib/query-keys";
import type { AdminStats } from "#/lib/types";

export function useAdminStats() {
	return useQuery({
		queryKey: queryKeys.admin.stats,
		queryFn: () => apiClient<AdminStats>("/api/admin/stats"),
		refetchInterval: 60_000,
	});
}
