import { Link } from "@tanstack/react-router";
import { Beer, MapPin, UtensilsCrossed, Wine } from "lucide-react";
import { Spinner } from "#/components/Spinner";
import { formatCuisineLabel } from "#/lib/cuisines";
import { useMyPlaceCheckIns } from "#/lib/hooks/usePlaceCheckIns";
import type { MyPlaceCheckIn } from "#/lib/types";

function formatDate(iso: string) {
	const d = new Date(`${iso}T00:00:00`);
	return d.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function placeIcon(item: MyPlaceCheckIn) {
	if (item.is_food) return UtensilsCrossed;
	if (item.bar_type === "brewery") return Beer;
	return Wine;
}

function placeKindLabel(item: MyPlaceCheckIn): string {
	const parts: string[] = [];
	if (item.is_food && item.cuisine)
		parts.push(formatCuisineLabel(item.cuisine));
	if (item.is_drink && item.bar_type) {
		parts.push(item.bar_type === "brewery" ? "Brewery" : "Bar");
	}
	return parts.join(" · ");
}

function PlaceRow({ item }: { item: MyPlaceCheckIn }) {
	const Icon = placeIcon(item);
	const iconBgClass = item.is_food
		? "bg-[rgba(245,158,11,0.14)] text-orange-700"
		: "bg-[rgba(79,184,178,0.14)] text-(--lagoon-deep)";
	return (
		<Link
			to="/place/$placeId"
			params={{ placeId: item.place_id }}
			className="flex items-center gap-3 rounded-lg border border-(--line) bg-(--surface-strong) px-3 py-2.5 no-underline hover:bg-(--surface)"
		>
			{item.place_image_url ? (
				<img
					src={item.place_image_url}
					alt=""
					className="h-12 w-12 shrink-0 rounded-md object-cover"
				/>
			) : (
				<div
					className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md ${iconBgClass}`}
				>
					<Icon size={22} />
				</div>
			)}
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium text-(--sea-ink)">
					{item.place_name}
				</p>
				<p className="truncate text-xs text-(--sea-ink-soft)">
					{placeKindLabel(item)}
					{item.place_city ? ` · ${item.place_city}` : ""}
				</p>
			</div>
			<p className="shrink-0 text-xs text-(--sea-ink-soft)">
				{formatDate(item.checkin_date)}
			</p>
		</Link>
	);
}

export function ProfileCheckInsTab() {
	const query = useMyPlaceCheckIns();

	if (query.isLoading) {
		return <Spinner className="py-12" />;
	}

	const stats = query.data?.stats;
	const checkins = query.data?.checkins ?? [];
	const totalCheckins = stats?.total_checkins ?? 0;

	if (totalCheckins === 0) {
		return (
			<div className="rounded-lg border border-dashed border-(--line) p-10 text-center">
				<MapPin className="mx-auto mb-2 text-(--sea-ink-soft)" size={28} />
				<p className="text-sm text-(--sea-ink-soft)">
					No check-ins yet. Visit a spot from the{" "}
					<Link
						to="/places"
						search={{ tab: "food" }}
						className="font-medium text-(--lagoon-deep) no-underline hover:text-(--lagoon)"
					>
						Places
					</Link>{" "}
					page and check in while you&apos;re there.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
				<StatCard label="Total check-ins" value={totalCheckins} />
				<StatCard label="Unique places" value={stats?.unique_places ?? 0} />
				<StatCard label="Restaurants" value={stats?.unique_foods ?? 0} />
				<StatCard label="Breweries" value={stats?.unique_breweries ?? 0} />
				<StatCard label="Bars" value={stats?.unique_bars ?? 0} />
			</div>

			<div>
				<h2 className="mb-3 text-sm font-semibold text-(--sea-ink)">
					Recent check-ins
				</h2>
				<div className="space-y-2">
					{checkins.map((item) => (
						<PlaceRow key={item.id} item={item} />
					))}
				</div>
			</div>
		</div>
	);
}

function StatCard({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-lg border border-(--line) bg-(--surface-strong) p-4">
			<p className="text-xs text-(--sea-ink-soft)">{label}</p>
			<p className="mt-1 text-2xl font-bold text-(--sea-ink)">
				{value.toLocaleString()}
			</p>
		</div>
	);
}
