import { useGSAP } from "@gsap/react";
import { Link } from "@tanstack/react-router";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";
import type { Beverage } from "#/lib/types";

gsap.registerPlugin(ScrollTrigger);

function priceLabel(level?: number) {
	if (!level) return null;
	return "$".repeat(level);
}

export function BeverageCard({ beverage }: { beverage: Beverage }) {
	const cardRef = useRef<HTMLDivElement>(null);

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

	const typeColor =
		beverage.Type === "brewery"
			? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
			: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";

	return (
		<div
			ref={cardRef}
			className="overflow-hidden rounded-xl border border-(--line) bg-(--surface-strong) shadow-sm transition-shadow hover:shadow-md"
		>
			<Link
				to="/beverages/$beverageId"
				params={{ beverageId: beverage.ID }}
				className="block no-underline"
			>
				{beverage.ImageUrl ? (
					<img
						src={beverage.ImageUrl}
						alt={beverage.Name}
						className="h-40 w-full object-cover"
					/>
				) : (
					<div className="flex h-40 items-center justify-center bg-(--surface) text-4xl">
						{beverage.Type === "brewery" ? "🍺" : "🍸"}
					</div>
				)}

				<div className="space-y-2 p-4">
					<div className="flex items-start justify-between gap-2">
						<h3 className="text-base font-semibold leading-tight text-(--sea-ink)">
							{beverage.Name}
						</h3>
						<span
							className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${typeColor}`}
						>
							{beverage.Type === "brewery" ? "Brewery" : "Bar"}
						</span>
					</div>

					{beverage.Address && (
						<p className="text-sm text-(--sea-ink-soft)">
							{beverage.Address}
							{beverage.City && `, ${beverage.City}`}
							{beverage.State && `, ${beverage.State}`}
						</p>
					)}

					<div className="flex flex-wrap items-center gap-2">
						{beverage.Tags?.map((tag) => (
							<span
								key={tag}
								className="rounded-full bg-[rgba(123,142,232,0.14)] px-2 py-0.5 text-xs font-medium text-(--lagoon-deep)"
							>
								{tag}
							</span>
						))}
						{beverage.PriceLevel && (
							<span className="ml-auto text-sm font-medium text-(--sea-ink-soft)">
								{priceLabel(beverage.PriceLevel)}
							</span>
						)}
					</div>
				</div>
			</Link>
		</div>
	);
}
