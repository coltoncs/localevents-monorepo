import { Link } from "@tanstack/react-router";
import { formatCuisineLabel } from "#/lib/cuisines";
import { usePlaces } from "#/lib/hooks/usePlaces";
import type { Place } from "#/lib/types";

const WALKABLE_RADIUS_MI = 0.5;
const MAX_PER_SECTION = 4;

interface NearbyPlacesProps {
	lat: number;
	lng: number;
}

export function NearbyPlaces({ lat, lng }: NearbyPlacesProps) {
	const { data, isLoading } = usePlaces({
		lat,
		lng,
		radius: WALKABLE_RADIUS_MI,
	});

	if (isLoading) return null;

	const all = data?.places ?? [];
	const foods = all.filter((p) => p.IsFood).slice(0, MAX_PER_SECTION);
	const drinks = all.filter((p) => p.IsDrink).slice(0, MAX_PER_SECTION);

	if (foods.length === 0 && drinks.length === 0) return null;

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
						{foods.map((place) => (
							<PlaceItem
								key={`f-${place.ID}`}
								place={place}
								lat={lat}
								lng={lng}
								kind="food"
							/>
						))}
					</ul>
				</div>
			)}

			{drinks.length > 0 && (
				<div>
					<h3 className="text-xs font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
						Drink
					</h3>
					<ul className="mt-1.5 divide-y divide-(--line)">
						{drinks.map((place) => (
							<PlaceItem
								key={`d-${place.ID}`}
								place={place}
								lat={lat}
								lng={lng}
								kind="drink"
							/>
						))}
					</ul>
				</div>
			)}
		</section>
	);
}

function PlaceItem({
	place,
	lat,
	lng,
	kind,
}: {
	place: Place;
	lat: number;
	lng: number;
	kind: "food" | "drink";
}) {
	const distance = haversineMiles(lat, lng, place.Latitude, place.Longitude);
	const label =
		kind === "food" && place.Cuisine
			? formatCuisineLabel(place.Cuisine)
			: place.BarType === "brewery"
				? "Brewery"
				: "Bar";
	return (
		<li>
			<Link
				to="/place/$placeId"
				params={{ placeId: place.ID }}
				className="flex items-baseline justify-between gap-2 py-1.5 no-underline hover:text-(--lagoon-deep)"
			>
				<span className="truncate text-sm font-medium text-(--sea-ink)">
					{place.Name}
				</span>
				<span className="shrink-0 text-xs text-(--sea-ink-soft)">
					{label} · {formatDistance(distance)}
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
