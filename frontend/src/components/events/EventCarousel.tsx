import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { type ReactNode, useRef } from "react";
import { EventCard } from "#/components/events/EventCard";
import type { Event } from "#/lib/types";

gsap.registerPlugin(useGSAP, Draggable, InertiaPlugin);

interface Props {
	events: Event[];
	// Override how each card renders.
	renderItem?: (event: Event) => ReactNode;
}

export function EventCarousel({ events, renderItem }: Props) {
	const viewportRef = useRef<HTMLDivElement>(null);
	const trackRef = useRef<HTMLDivElement>(null);

	// Re-create the draggable when the cards change so bounds match content.
	const depKey = events.map((e) => e.ID).join(",");

	useGSAP(
		() => {
			const viewport = viewportRef.current;
			const track = trackRef.current;
			if (!viewport || !track) return;

			// Clamp drag to the row: 0 (start) down to the overflow amount.
			const getBounds = () => {
				const overflow = track.scrollWidth - viewport.offsetWidth;
				return { minX: overflow > 0 ? -overflow : 0, maxX: 0 };
			};

			const [draggable] = Draggable.create(track, {
				type: "x",
				// InertiaPlugin gives the throw/momentum glide after release.
				inertia: true,
				bounds: getBounds(),
				// Soft pull-back when dragging past either edge.
				edgeResistance: 0.85,
				// Clicks on cards still fire on a tap; a real drag suppresses them.
				dragClickables: true,
				// Let vertical page scroll pass through on touch.
				allowNativeTouchScrolling: true,
			});

			const onResize = () => draggable.applyBounds(getBounds());
			window.addEventListener("resize", onResize);

			return () => {
				window.removeEventListener("resize", onResize);
				draggable.kill();
				gsap.set(track, { x: 0 });
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
			<div ref={trackRef} className="flex w-max">
				{events.map((event) => (
					<div key={event.ID} className="shrink-0 pr-4">
						<div className="w-72">{render(event)}</div>
					</div>
				))}
			</div>
		</div>
	);
}
