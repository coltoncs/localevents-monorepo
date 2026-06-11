import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "#/components/auth/ProtectedRoute";
import { ProfileCheckInsTab } from "#/components/profile/ProfileCheckInsTab";
import { ProfileFeaturedEventsTab } from "#/components/profile/ProfileFeaturedEventsTab";
import { ProfileOverviewTab } from "#/components/profile/ProfileOverviewTab";
import { ProfileSavedTab } from "#/components/profile/ProfileSavedTab";
import { ProfileSettingsTab } from "#/components/profile/ProfileSettingsTab";
import {
	type ProfileTab,
	ProfileTabNav,
} from "#/components/profile/ProfileTabNav";

const VALID_TABS: ProfileTab[] = [
	"overview",
	"saved",
	"featured",
	"checkins",
	"settings",
];

interface ProfileSearch {
	tab?: ProfileTab;
}

export const Route = createFileRoute("/profile")({
	validateSearch: (search: Record<string, unknown>): ProfileSearch => ({
		tab: VALID_TABS.includes(search.tab as ProfileTab)
			? (search.tab as ProfileTab)
			: undefined,
	}),
	component: ProfilePage,
});

function ProfilePage() {
	return (
		<ProtectedRoute>
			<ProfileContent />
		</ProtectedRoute>
	);
}

function ProfileContent() {
	const { tab } = Route.useSearch();
	const active: ProfileTab = tab ?? "overview";

	return (
		<div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<h1 className="text-2xl font-bold text-(--sea-ink)">Profile</h1>
				<ProfileTabNav active={active} />
			</div>

			{active === "overview" && <ProfileOverviewTab />}
			{active === "saved" && <ProfileSavedTab />}
			{active === "featured" && <ProfileFeaturedEventsTab />}
			{active === "checkins" && <ProfileCheckInsTab />}
			{active === "settings" && <ProfileSettingsTab />}
		</div>
	);
}
