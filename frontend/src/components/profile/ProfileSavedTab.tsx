import { useState } from "react";
import { EventCard } from "#/components/events/EventCard";
import { EventTable } from "#/components/events/EventTable";
import { Spinner } from "#/components/Spinner";
import { ViewToggle } from "#/components/ViewToggle";
import { useSavedEvents, useUnsaveEvent } from "#/lib/hooks/useSavedEvents";

export function ProfileSavedTab() {
	const { data: events = [], isLoading } = useSavedEvents();
	const unsave = useUnsaveEvent();
	const [displayMode, setDisplayMode] = useState<"cards" | "list">("cards");

	if (isLoading) return <Spinner className="py-12" />;

	if (events.length === 0) {
		return (
			<div className="py-12 text-center text-(--sea-ink-soft)">
				No saved events yet. Browse events and save ones you&apos;re interested
				in!
			</div>
		);
	}

	return (
		<div>
			<div className="mb-4 flex justify-end">
				<ViewToggle view={displayMode} onChange={setDisplayMode} />
			</div>
			{displayMode === "cards" ? (
				<div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
					{events.map((event) => (
						<div key={event.ID} className="relative mb-4 break-inside-avoid">
							<EventCard event={event} />
							<button
								type="button"
								onClick={() => unsave.mutate(event.ID)}
								disabled={unsave.isPending}
								className="absolute right-2 top-2 rounded-md bg-(--surface-strong)/90 px-2 py-1 text-xs font-medium text-red-600 shadow-sm hover:bg-red-50"
							>
								Unsave
							</button>
						</div>
					))}
				</div>
			) : (
				<EventTable events={events} />
			)}
		</div>
	);
}
