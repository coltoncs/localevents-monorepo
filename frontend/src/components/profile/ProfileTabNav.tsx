import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "@tanstack/react-router";
import { useUserRole } from "#/lib/hooks/useUserRole";

export type ProfileTab =
	| "overview"
	| "saved"
	| "featured"
	| "checkins"
	| "settings";

const TABS: { id: ProfileTab; label: string; featureGated?: boolean }[] = [
	{ id: "overview", label: "Overview" },
	{ id: "saved", label: "Saved" },
	{ id: "featured", label: "Featured", featureGated: true },
	{ id: "checkins", label: "Check-ins" },
	{ id: "settings", label: "Settings" },
];

export function ProfileTabNav({ active }: { active: ProfileTab }) {
	const navigate = useNavigate();
	const { has } = useAuth();
	const { isAdmin } = useUserRole();
	// The Featured tab is only relevant to users who can feature events
	// (admins, or subscribers with the feature_events entitlement).
	const canFeature =
		isAdmin || (typeof has === "function" && has({ feature: "feature_events" }));
	const tabs = TABS.filter((tab) => !tab.featureGated || canFeature);

	return (
		<div className="inline-flex flex-wrap rounded-lg border border-(--line) p-0.5">
			{tabs.map((tab) => {
				const isActive = tab.id === active;
				return (
					<button
						key={tab.id}
						type="button"
						onClick={() =>
							navigate({
								to: "/profile",
								search: { tab: tab.id === "overview" ? undefined : tab.id },
								replace: true,
							})
						}
						className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
							isActive
								? "bg-(--lagoon) text-white"
								: "text-(--sea-ink-soft) hover:text-(--sea-ink)"
						}`}
					>
						{tab.label}
					</button>
				);
			})}
		</div>
	);
}
