import { useGSAP } from "@gsap/react";
import { Link } from "@tanstack/react-router";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Users } from "lucide-react";
import { useRef } from "react";
import { useFoodCheckInCounts } from "#/lib/hooks/useFoodCheckIns";
import type { Food } from "#/lib/types";

gsap.registerPlugin(ScrollTrigger);

function priceLabel(level?: number) {
	if (!level) return null;
	return "$".repeat(level);
}

export function formatCuisineLabel(cuisine: string): string {
	return cuisine
		.split("_")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
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
	other: "🍽️",
};

export function FoodCard({ food }: { food: Food }) {
	const cardRef = useRef<HTMLDivElement>(null);
	const { data: checkInCounts } = useFoodCheckInCounts(food.ID);

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

	const emoji = CUISINE_EMOJI[food.Cuisine] ?? "🍽️";

	return (
		<div
			ref={cardRef}
			className="overflow-hidden rounded-xl border border-(--line) bg-(--surface-strong) shadow-sm transition-shadow hover:shadow-md"
		>
			<Link
				to="/food/$foodId"
				params={{ foodId: food.ID }}
				className="block no-underline"
			>
				{food.ImageUrl ? (
					<img
						src={food.ImageUrl}
						alt={food.Name}
						className="h-40 w-full object-cover"
					/>
				) : (
					<div className="flex h-40 items-center justify-center bg-(--surface) text-4xl">
						{emoji}
					</div>
				)}

				<div className="space-y-2 p-4">
					<div className="flex items-start justify-between gap-2">
						<h3 className="text-base font-semibold leading-tight text-(--sea-ink)">
							{food.Name}
						</h3>
						<span className="shrink-0 rounded-full bg-orange-200 px-2 py-0.5 text-xs font-medium text-orange-900 dark:bg-orange-900/30 dark:text-orange-300">
							{formatCuisineLabel(food.Cuisine)}
						</span>
					</div>

					{food.Address && (
						<p className="text-sm text-(--sea-ink-soft)">
							{food.Address}
							{food.City && `, ${food.City}`}
							{food.State && `, ${food.State}`}
						</p>
					)}

					<div className="flex flex-wrap items-center gap-2">
						{food.Tags?.map((tag) => (
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
						{food.PriceLevel && (
							<span
								className={`${checkInCounts && checkInCounts.unique > 0 ? "" : "ml-auto"} text-sm font-medium text-(--sea-ink-soft)`}
							>
								{priceLabel(food.PriceLevel)}
							</span>
						)}
					</div>
				</div>
			</Link>
		</div>
	);
}
