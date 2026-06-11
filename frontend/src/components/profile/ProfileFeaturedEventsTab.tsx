import { useAuth } from "@clerk/clerk-react";
import { useState } from "react";
import { EventCard } from "#/components/events/EventCard";
import { EventTable } from "#/components/events/EventTable";
import { Spinner } from "#/components/Spinner";
import { ViewToggle } from "#/components/ViewToggle";
import {
	useFeatureQuota,
	useMyFeaturedEvents,
} from "#/lib/hooks/useFeaturedEvents";
import { useUserRole } from "#/lib/hooks/useUserRole";

// Shows the events the current user has featured. Any subscriber can feature
// any event, so this is sourced from a dedicated "events I featured" endpoint.
export function ProfileFeaturedEventsTab() {
	const { has } = useAuth();
	const { isAdmin } = useUserRole();
	const canFeature =
		isAdmin || (typeof has === "function" && has({ feature: "feature_events" }));

	const { data: events = [], isLoading } = useMyFeaturedEvents(canFeature);
	const { data: quota } = useFeatureQuota(canFeature);
	const [displayMode, setDisplayMode] = useState<"cards" | "list">("cards");

	if (!canFeature) {
		return (
			<div className="py-12 text-center text-(--sea-ink-soft)">
				Subscribe to feature events and they'll show up here.
			</div>
		);
	}

	if (isLoading) return <Spinner className="py-12" />;

	if (events.length === 0) {
		return (
			<div className="py-12 text-center text-(--sea-ink-soft)">
				You haven't featured any events yet. Open an event and tap "★ Feature"
				to highlight it.
			</div>
		);
	}

	return (
		<div>
			<div className="mb-4 flex items-center justify-between gap-3">
				{quota && !quota.unlimited ? (
					<p className="text-sm text-(--sea-ink-soft)">
						{quota.used} of {quota.limit} featured this month
					</p>
				) : (
					<span />
				)}
				<ViewToggle view={displayMode} onChange={setDisplayMode} />
			</div>
			{displayMode === "cards" ? (
				<div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
					{events.map((event) => (
						<div key={event.ID} className="mb-4 break-inside-avoid">
							<EventCard event={event} />
						</div>
					))}
				</div>
			) : (
				<EventTable events={events} />
			)}
		</div>
	);
}
