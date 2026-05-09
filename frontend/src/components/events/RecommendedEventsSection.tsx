import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { EventCard } from "#/components/events/EventCard";
import {
	useRecommendations,
	useRecordEventView,
} from "#/lib/hooks/useRecommendations";
import type { Event } from "#/lib/types";

interface Props {
	lat: number;
	lng: number;
	radius?: number;
}

export function RecommendedEventsSection({ lat, lng, radius }: Props) {
	const { data, isLoading } = useRecommendations({
		lat,
		lng,
		radius,
		limit: 9,
	});

	console.log(data);

	if (isLoading || !data) return null;
	if (data.events.length === 0) return null;

	const isLearning = data.status === "learning";

	return (
		<section className="mt-12 w-full max-w-5xl text-left">
			<div className="mb-4 flex items-center justify-between">
				<div>
					<h2 className="text-lg font-bold text-(--sea-ink)">
						{isLearning ? "Trending Near You" : "Recommended for You"}
					</h2>
					{isLearning && data.saves_remaining > 0 && (
						<p className="mt-1 text-xs text-(--sea-ink-soft)">
							Save {data.saves_remaining} more event
							{data.saves_remaining === 1 ? "" : "s"} to unlock personalized
							recommendations
						</p>
					)}
				</div>
				<Link
					to="/events"
					className="text-sm font-medium text-(--lagoon-deep) hover:text-(--lagoon)"
				>
					Browse all
				</Link>
			</div>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{data.events.map((event) => (
					<TrackedEventCard key={event.ID} event={event} />
				))}
			</div>
		</section>
	);
}

// TrackedEventCard fires a single impression when the card first becomes
// 50%+ visible in the viewport. Used as a soft signal for the user's
// preference vector.
function TrackedEventCard({ event }: { event: Event }) {
	const ref = useRef<HTMLDivElement>(null);
	const fired = useRef(false);
	const { mutate } = useRecordEventView();

	useEffect(() => {
		if (!ref.current) return;
		const node = ref.current;
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting && !fired.current) {
						fired.current = true;
						mutate(event.ID);
						observer.disconnect();
					}
				}
			},
			{ threshold: 0.5 },
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, [event.ID, mutate]);

	return (
		<div ref={ref}>
			<EventCard event={event} />
		</div>
	);
}
