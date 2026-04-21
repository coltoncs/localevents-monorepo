import { Link } from "@tanstack/react-router";
import { Beer, MapPin, UtensilsCrossed, Wine } from "lucide-react";
import { formatCuisineLabel } from "#/components/FoodCard";
import { Spinner } from "#/components/Spinner";
import { useMyCheckIns } from "#/lib/hooks/useBeverageCheckIns";
import { useMyFoodCheckIns } from "#/lib/hooks/useFoodCheckIns";
import type { MyCheckIn, MyFoodCheckIn } from "#/lib/types";

type CombinedItem =
	| { kind: "drink"; sortKey: string; item: MyCheckIn }
	| { kind: "food"; sortKey: string; item: MyFoodCheckIn };

function formatDate(iso: string) {
	const d = new Date(`${iso}T00:00:00`);
	return d.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function DrinkRow({ item }: { item: MyCheckIn }) {
	const Icon = item.beverage_type === "brewery" ? Beer : Wine;
	return (
		<Link
			to="/drinks/$beverageId"
			params={{ beverageId: item.beverage_id }}
			className="flex items-center gap-3 rounded-lg border border-(--line) bg-(--surface-strong) px-3 py-2.5 no-underline hover:bg-(--surface)"
		>
			{item.beverage_image_url ? (
				<img
					src={item.beverage_image_url}
					alt=""
					className="h-12 w-12 shrink-0 rounded-md object-cover"
				/>
			) : (
				<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[rgba(79,184,178,0.14)] text-(--lagoon-deep)">
					<Icon size={22} />
				</div>
			)}
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium text-(--sea-ink)">
					{item.beverage_name}
				</p>
				<p className="truncate text-xs text-(--sea-ink-soft)">
					{item.beverage_type === "brewery" ? "Brewery" : "Bar"}
					{item.beverage_city ? ` · ${item.beverage_city}` : ""}
				</p>
			</div>
			<p className="shrink-0 text-xs text-(--sea-ink-soft)">
				{formatDate(item.checkin_date)}
			</p>
		</Link>
	);
}

function FoodRow({ item }: { item: MyFoodCheckIn }) {
	return (
		<Link
			to="/food/$foodId"
			params={{ foodId: item.food_id }}
			className="flex items-center gap-3 rounded-lg border border-(--line) bg-(--surface-strong) px-3 py-2.5 no-underline hover:bg-(--surface)"
		>
			{item.food_image_url ? (
				<img
					src={item.food_image_url}
					alt=""
					className="h-12 w-12 shrink-0 rounded-md object-cover"
				/>
			) : (
				<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[rgba(245,158,11,0.14)] text-orange-700">
					<UtensilsCrossed size={22} />
				</div>
			)}
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium text-(--sea-ink)">
					{item.food_name}
				</p>
				<p className="truncate text-xs text-(--sea-ink-soft)">
					{formatCuisineLabel(item.food_cuisine)}
					{item.food_city ? ` · ${item.food_city}` : ""}
				</p>
			</div>
			<p className="shrink-0 text-xs text-(--sea-ink-soft)">
				{formatDate(item.checkin_date)}
			</p>
		</Link>
	);
}

export function ProfileCheckInsTab() {
	const drinksQuery = useMyCheckIns();
	const foodsQuery = useMyFoodCheckIns();

	if (drinksQuery.isLoading || foodsQuery.isLoading) {
		return <Spinner className="py-12" />;
	}

	const drinkStats = drinksQuery.data?.stats;
	const foodStats = foodsQuery.data?.stats;
	const drinkCheckins = drinksQuery.data?.checkins ?? [];
	const foodCheckins = foodsQuery.data?.checkins ?? [];

	const totalCheckins =
		(drinkStats?.total_checkins ?? 0) + (foodStats?.total_checkins ?? 0);

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

	const combined: CombinedItem[] = [
		...drinkCheckins.map<CombinedItem>((item) => ({
			kind: "drink",
			sortKey: item.created_at,
			item,
		})),
		...foodCheckins.map<CombinedItem>((item) => ({
			kind: "food",
			sortKey: item.created_at,
			item,
		})),
	].sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1));

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
				<StatCard label="Total check-ins" value={totalCheckins} />
				<StatCard
					label="Unique venues"
					value={
						(drinkStats?.unique_venues ?? 0) +
						(foodStats?.unique_restaurants ?? 0)
					}
				/>
				<StatCard label="Breweries" value={drinkStats?.unique_breweries ?? 0} />
				<StatCard label="Bars" value={drinkStats?.unique_bars ?? 0} />
				<StatCard
					label="Restaurants"
					value={foodStats?.unique_restaurants ?? 0}
				/>
			</div>

			<div>
				<h2 className="mb-3 text-sm font-semibold text-(--sea-ink)">
					Recent check-ins
				</h2>
				<div className="space-y-2">
					{combined.map((entry) =>
						entry.kind === "drink" ? (
							<DrinkRow key={`d-${entry.item.id}`} item={entry.item} />
						) : (
							<FoodRow key={`f-${entry.item.id}`} item={entry.item} />
						),
					)}
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
