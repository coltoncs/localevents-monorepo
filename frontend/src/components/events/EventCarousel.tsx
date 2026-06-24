import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { type ReactNode, useRef } from "react";
import { EventCard } from "#/components/events/EventCard";
import { horizontalLoop, type LoopTimeline } from "#/lib/horizontal-loop";
import type { Event } from "#/lib/types";

gsap.registerPlugin(useGSAP);

interface Props {
	events: Event[];
	// Override how each card renders.
	renderItem?: (event: Event) => ReactNode;
	// Roughly 100px/sec per unit (default 0.5 for a gentle drift).
	speed?: number;
}

export function EventCarousel({ events, renderItem, speed = 0.5 }: Props) {
	const viewportRef = useRef<HTMLDivElement>(null);
	const trackRef = useRef<HTMLDivElement>(null);

	// Re-create the loop when the cards change so widths/bounds match content.
	const depKey = events.map((e) => e.ID).join(",");

	useGSAP(
		() => {
			const track = trackRef.current;
			if (!track) return;

			const items = gsap.utils.toArray<HTMLElement>(track.children);
			// Need enough items to fill the row, otherwise a loop has nothing to
			// wrap and the gaps look broken.
			if (items.length < 2) return;

			const loop: LoopTimeline = horizontalLoop(items, {
				speed,
				repeat: -1,
				paddingRight: 16, // matches the pr-4 trailing gap between cards
				draggable: true,
			});

			// Pause the drift while the visitor hovers or focuses inside the row,
			// so they can read/click without it sliding away. Drag pausing is
			// handled inside the loop helper.
			const pause = () => loop.pause();
			const resume = () => loop.play();
			const viewport = viewportRef.current;
			viewport?.addEventListener("mouseenter", pause);
			viewport?.addEventListener("mouseleave", resume);
			viewport?.addEventListener("focusin", pause);
			viewport?.addEventListener("focusout", resume);

			return () => {
				viewport?.removeEventListener("mouseenter", pause);
				viewport?.removeEventListener("mouseleave", resume);
				viewport?.removeEventListener("focusin", pause);
				viewport?.removeEventListener("focusout", resume);
				loop.revertLoop();
			};
		},
		{ scope: viewportRef, dependencies: [depKey] },
	);

	if (events.length === 0) return null;

	const render =
		renderItem ??
		((event: Event) => <EventCard event={event} animateOnScroll={false} />);

	return (
		<div
			ref={viewportRef}
			className="event-marquee__viewport w-full cursor-grab touch-pan-y select-none active:cursor-grabbing"
		>
			{/* Spacing lives in the flex `gap` (not item padding) so every item's
			    content-box width and border-box width agree — a mismatch makes the
			    loop helper's measurements drift and the cards overlap over time. */}
			<div ref={trackRef} className="flex w-max gap-4">
				{events.map((event) => (
					<div key={event.ID} className="w-72 shrink-0">
						{render(event)}
					</div>
				))}
			</div>
		</div>
	);
}
