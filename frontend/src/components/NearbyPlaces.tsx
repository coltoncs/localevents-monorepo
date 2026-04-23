import { Link } from "@tanstack/react-router";
import { useBeverages } from "#/lib/hooks/useBeverages";
import { useFoods } from "#/lib/hooks/useFoods";
import type { Beverage, Food } from "#/lib/types";
import { formatCuisineLabel } from "./FoodCard";

const WALKABLE_RADIUS_MI = 0.5;
const MAX_PER_SECTION = 4;

interface NearbyPlacesProps {
	lat: number;
	lng: number;
}

export function NearbyPlaces({ lat, lng }: NearbyPlacesProps) {
	const { data: foodData, isLoading: foodsLoading } = useFoods({
		lat,
		lng,
		radius: WALKABLE_RADIUS_MI,
	});
	const { data: bevData, isLoading: bevsLoading } = useBeverages({
		lat,
		lng,
		radius: WALKABLE_RADIUS_MI,
	});

	if (foodsLoading || bevsLoading) return null;

	const foods = (foodData?.foods ?? []).slice(0, MAX_PER_SECTION);
	const beverages = (bevData?.beverages ?? []).slice(0, MAX_PER_SECTION);

	if (foods.length === 0 && beverages.length === 0) return null;

	return (
		<section className="space-y-3 rounded-lg border border-(--line) bg-(--surface-strong) p-4">
			<div>
				<h2 className="text-sm font-medium text-(--sea-ink-soft)">
					Walkable nearby
				</h2>
				<p className="text-xs text-(--sea-ink-soft)">
					Within a {WALKABLE_RADIUS_MI} mi walk
				</p>
			</div>

			{foods.length > 0 && (
				<div>
					<h3 className="text-xs font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
						Eat
					</h3>
					<ul className="mt-1.5 divide-y divide-(--line)">
						{foods.map((food) => (
							<FoodItem key={food.ID} food={food} lat={lat} lng={lng} />
						))}
					</ul>
				</div>
			)}

			{beverages.length > 0 && (
				<div>
					<h3 className="text-xs font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
						Drink
					</h3>
					<ul className="mt-1.5 divide-y divide-(--line)">
						{beverages.map((bev) => (
							<BeverageItem key={bev.ID} beverage={bev} lat={lat} lng={lng} />
						))}
					</ul>
				</div>
			)}
		</section>
	);
}

function FoodItem({
	food,
	lat,
	lng,
}: {
	food: Food;
	lat: number;
	lng: number;
}) {
	const distance = haversineMiles(lat, lng, food.Latitude, food.Longitude);
	return (
		<li>
			<Link
				to="/food/$foodId"
				params={{ foodId: food.ID }}
				className="flex items-baseline justify-between gap-2 py-1.5 no-underline hover:text-(--lagoon-deep)"
			>
				<span className="truncate text-sm font-medium text-(--sea-ink)">
					{food.Name}
				</span>
				<span className="shrink-0 text-xs text-(--sea-ink-soft)">
					{formatCuisineLabel(food.Cuisine)} · {formatDistance(distance)}
				</span>
			</Link>
		</li>
	);
}

function BeverageItem({
	beverage,
	lat,
	lng,
}: {
	beverage: Beverage;
	lat: number;
	lng: number;
}) {
	const distance = haversineMiles(
		lat,
		lng,
		beverage.Latitude,
		beverage.Longitude,
	);
	const typeLabel = beverage.Type === "brewery" ? "Brewery" : "Bar";
	return (
		<li>
			<Link
				to="/drinks/$beverageId"
				params={{ beverageId: beverage.ID }}
				className="flex items-baseline justify-between gap-2 py-1.5 no-underline hover:text-(--lagoon-deep)"
			>
				<span className="truncate text-sm font-medium text-(--sea-ink)">
					{beverage.Name}
				</span>
				<span className="shrink-0 text-xs text-(--sea-ink-soft)">
					{typeLabel} · {formatDistance(distance)}
				</span>
			</Link>
		</li>
	);
}

function formatDistance(miles: number): string {
	if (miles < 0.1) return "<0.1 mi";
	return `${miles.toFixed(1)} mi`;
}

function haversineMiles(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number,
): number {
	const R = 3958.8;
	const toRad = (x: number) => (x * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(a));
}
