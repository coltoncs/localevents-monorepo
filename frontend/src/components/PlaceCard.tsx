import { useGSAP } from "@gsap/react";
import { Link } from "@tanstack/react-router";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Users } from "lucide-react";
import { useRef } from "react";
import { formatCuisineLabel } from "#/lib/cuisines";
import { usePlaceCheckInCounts } from "#/lib/hooks/usePlaceCheckIns";
import type { Place } from "#/lib/types";

gsap.registerPlugin(ScrollTrigger);

function priceLabel(level?: number) {
	if (!level) return null;
	return "$".repeat(level);
}

const CUISINE_EMOJI: Record<string, string> = {
	american: "🍔",
	italian: "🍝",
	mexican: "🌮",
	chinese: "🥡",
	japanese: "🍣",
	korean: "🍲",
	thai: "🍜",
	vietnamese: "🍲",
	indian: "🍛",
	mediterranean: "🥙",
	middle_eastern: "🥙",
	french: "🥐",
	bbq: "🍖",
	pizza: "🍕",
	seafood: "🦞",
	vegan: "🥗",
	cafe: "☕",
	bakery: "🥐",
	dessert: "🍰",
};

function placeEmoji(place: Place): string {
	if (place.IsFood && place.Cuisine) {
		const e = CUISINE_EMOJI[place.Cuisine];
		if (e) return e;
	}
	if (place.IsDrink) {
		return place.BarType === "brewery" ? "🍺" : "🍸";
	}
	return "🍽️";
}

function PlaceBadges({ place }: { place: Place }) {
	const badges: { key: string; label: string; cls: string }[] = [];
	if (place.IsFood && place.Cuisine) {
		badges.push({
			key: "cuisine",
			label: formatCuisineLabel(place.Cuisine),
			cls: "bg-orange-200 text-orange-900 dark:bg-orange-900/30 dark:text-orange-300",
		});
	}
	if (place.IsDrink && place.BarType) {
		badges.push({
			key: "bar_type",
			label: place.BarType === "brewery" ? "Brewery" : "Bar",
			cls:
				place.BarType === "brewery"
					? "bg-amber-200 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300"
					: "bg-purple-200 text-purple-900 dark:bg-purple-900/30 dark:text-purple-300",
		});
	}
	return (
		<div className="flex shrink-0 flex-wrap justify-end gap-1">
			{badges.map((b) => (
				<span
					key={b.key}
					className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.cls}`}
				>
					{b.label}
				</span>
			))}
		</div>
	);
}

export function PlaceCard({ place }: { place: Place }) {
	const cardRef = useRef<HTMLDivElement>(null);
	const { data: checkInCounts } = usePlaceCheckInCounts(place.ID);

	useGSAP(
		() => {
			gsap.fromTo(
				cardRef.current,
				{ y: 40, opacity: 0 },
				{
					y: 0,
					opacity: 1,
					duration: 0.6,
					ease: "power3.out",
					scrollTrigger: {
						trigger: cardRef.current,
						start: "top 92%",
						toggleActions: "play none none none",
					},
				},
			);
		},
		{ scope: cardRef },
	);

	return (
		<div
			ref={cardRef}
			className="overflow-hidden rounded-xl border border-(--line) bg-(--surface-strong) shadow-sm transition-shadow hover:shadow-md"
		>
			<Link
				to="/place/$placeId"
				params={{ placeId: place.ID }}
				className="block no-underline"
			>
				{place.ImageUrl ? (
					<img
						src={place.ImageUrl}
						alt={place.Name}
						className="h-40 w-full object-cover"
					/>
				) : (
					<div className="flex h-40 items-center justify-center bg-(--surface) text-4xl">
						{placeEmoji(place)}
					</div>
				)}

				<div className="space-y-2 p-4">
					<div className="flex items-start justify-between gap-2">
						<h3 className="text-base font-semibold leading-tight text-(--sea-ink)">
							{place.Name}
						</h3>
						<PlaceBadges place={place} />
					</div>

					{place.Address && (
						<p className="text-sm text-(--sea-ink-soft)">
							{place.Address}
							{place.City && `, ${place.City}`}
							{place.State && `, ${place.State}`}
						</p>
					)}

					<div className="flex flex-wrap items-center gap-2">
						{place.Tags?.map((tag) => (
							<span
								key={tag}
								className="rounded-full bg-[rgba(123,142,232,0.14)] px-2 py-0.5 text-xs font-medium text-(--lagoon-deep)"
							>
								{tag}
							</span>
						))}
						{checkInCounts && checkInCounts.unique > 0 ? (
							<span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-(--sea-ink-soft)">
								<Users size={12} />
								{checkInCounts.unique}
							</span>
						) : null}
						{place.PriceLevel && (
							<span
								className={`${checkInCounts && checkInCounts.unique > 0 ? "" : "ml-auto"} text-sm font-medium text-(--sea-ink-soft)`}
							>
								{priceLabel(place.PriceLevel)}
							</span>
						)}
					</div>
				</div>
			</Link>
		</div>
	);
}
