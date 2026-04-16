import { createFileRoute } from "@tanstack/react-router";
import { AdminApplicationsTab } from "#/components/admin/AdminApplicationsTab";
import { AdminBeveragesTab } from "#/components/admin/AdminBeveragesTab";
import { AdminDashboardTab } from "#/components/admin/AdminDashboardTab";
import { AdminOpsTab } from "#/components/admin/AdminOpsTab";
import { AdminSuggestionsTab } from "#/components/admin/AdminSuggestionsTab";
import { type AdminTab, AdminTabNav } from "#/components/admin/AdminTabNav";
import { RoleProtectedRoute } from "#/components/RoleProtectedRoute";
import { useAdminStats } from "#/lib/hooks/useAdminStats";

const VALID_TABS: AdminTab[] = [
	"dashboard",
	"applications",
	"suggestions",
	"beverages",
	"ops",
];

interface AdminSearch {
	tab?: AdminTab;
}

export const Route = createFileRoute("/admin")({
	validateSearch: (search: Record<string, unknown>): AdminSearch => ({
		tab: VALID_TABS.includes(search.tab as AdminTab)
			? (search.tab as AdminTab)
			: undefined,
	}),
	component: AdminPage,
});

function AdminPage() {
	return (
		<RoleProtectedRoute roles={["admin"]}>
			<AdminContent />
		</RoleProtectedRoute>
	);
}

function AdminContent() {
	const { tab } = Route.useSearch();
	const active: AdminTab = tab ?? "dashboard";
	const { data: stats } = useAdminStats();

	const counts = {
		applications: stats?.pending_applications,
		suggestions: stats?.pending_suggestions,
	};

	return (
		<div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<h1 className="text-2xl font-bold text-(--sea-ink)">Admin Dashboard</h1>
				<AdminTabNav active={active} counts={counts} />
			</div>

			{active === "dashboard" && <AdminDashboardTab />}
			{active === "applications" && <AdminApplicationsTab />}
			{active === "suggestions" && <AdminSuggestionsTab />}
			{active === "beverages" && <AdminBeveragesTab />}
			{active === "ops" && <AdminOpsTab />}
		</div>
	);
}
