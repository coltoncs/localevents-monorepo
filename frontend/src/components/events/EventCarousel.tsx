import { useGSAP } from "@gsap/react";
import { type ReactNode, useRef } from "react";
import { EventCard } from "#/components/events/EventCard";
import { horizontalLoop, type LoopTimeline } from "#/lib/horizontal-loop";
import type { Event } from "#/lib/types";

interface Props {
	events: Event[];
	// Override how each card renders.
	renderItem?: (event: Event) => ReactNode;
	// Drift right-to-left by default; set true to drift left-to-right.
	reverse?: boolean;
}

// Repeat the source list up to this many cards so the row is wide enough to
// span the viewport, otherwise a short list would leave a gap as items loop.
const MIN_ITEMS = 4;
// GSAP horizontalLoop speed units (~100px/sec each).
const SPEED_DESKTOP = 0.5;
const SPEED_MOBILE = 1;

export function EventCarousel({ events, renderItem, reverse }: Props) {
	const viewportRef = useRef<HTMLDivElement>(null);
	const trackRef = useRef<HTMLDivElement>(null);

	// Re-create the loop when the cards or direction change.
	const loopKey = `${reverse ? "r" : "f"}:${events.map((e) => e.ID).join(",")}`;

	useGSAP(
		() => {
			const track = trackRef.current;
			if (!track || track.children.length === 0) return;

			const mobile = window.matchMedia("(max-width: 640px)").matches;
			const reduced = window.matchMedia(
				"(prefers-reduced-motion: reduce)",
			).matches;
			const canHover = window.matchMedia("(hover: hover)").matches;

			const loop: LoopTimeline = horizontalLoop(track.children, {
				speed: mobile ? SPEED_MOBILE : SPEED_DESKTOP,
				repeat: -1,
				reversed: reverse,
				paused: reduced,
				draggable: true,
				// Snap to one card width on release for a tidy resting position.
				snap: false,
			});

			// Pause auto-scroll on hover (desktop only); drag handles pausing itself.
			let cleanupHover: (() => void) | undefined;
			if (canHover && !reduced && viewportRef.current) {
				const el = viewportRef.current;
				const pause = () => loop.pause();
				const resume = () => {
					if (!loop.draggable?.isPressed && !loop.draggable?.isThrowing)
						loop.play();
				};
				el.addEventListener("pointerenter", pause);
				el.addEventListener("pointerleave", resume);
				cleanupHover = () => {
					el.removeEventListener("pointerenter", pause);
					el.removeEventListener("pointerleave", resume);
				};
			}

			return () => {
				cleanupHover?.();
				loop.revertLoop();
			};
		},
		{ scope: viewportRef, dependencies: [loopKey] },
	);

	if (events.length === 0) return null;

	let base = events;
	while (base.length < MIN_ITEMS) base = [...base, ...events];

	const render =
		renderItem ??
		((event: Event) => <EventCard event={event} animateOnScroll={false} />);

	return (
		<div
			ref={viewportRef}
			className="event-marquee__viewport w-full cursor-grab touch-pan-y select-none active:cursor-grabbing"
		>
			<div ref={trackRef} className="flex w-max">
				{base.map((event, i) => (
					<div
						key={`${event.ID}-${i}`}
						// Trailing padding sets the gap between cards; the loop helper
						// measures it so the wrap stays seamless.
						className="shrink-0 pr-4"
					>
						<div className="w-72">{render(event)}</div>
					</div>
				))}
			</div>
		</div>
	);
}
