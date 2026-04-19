import { Link } from "@tanstack/react-router";
import { Beer, MapPin, Wine } from "lucide-react";
import { Spinner } from "#/components/Spinner";
import { useMyCheckIns } from "#/lib/hooks/useBeverageCheckIns";
import type { MyCheckIn } from "#/lib/types";

function formatDate(iso: string) {
	const d = new Date(`${iso}T00:00:00`);
	return d.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function CheckInRow({ item }: { item: MyCheckIn }) {
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

export function ProfileCheckInsTab() {
	const { data, isLoading } = useMyCheckIns();

	if (isLoading) return <Spinner className="py-12" />;
	if (!data) return null;

	const { stats, checkins } = data;

	if (checkins.length === 0) {
		return (
			<div className="rounded-lg border border-dashed border-(--line) p-10 text-center">
				<MapPin className="mx-auto mb-2 text-(--sea-ink-soft)" size={28} />
				<p className="text-sm text-(--sea-ink-soft)">
					No check-ins yet. Visit a brewery or bar from the{" "}
					<Link
						to="/drinks"
						className="font-medium text-(--lagoon-deep) no-underline hover:text-(--lagoon)"
					>
						Drinks
					</Link>{" "}
					page and check in while you&apos;re there.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<StatCard label="Total check-ins" value={stats.total_checkins} />
				<StatCard label="Unique venues" value={stats.unique_venues} />
				<StatCard label="Breweries" value={stats.unique_breweries} />
				<StatCard label="Bars" value={stats.unique_bars} />
			</div>

			<div>
				<h2 className="mb-3 text-sm font-semibold text-(--sea-ink)">
					Recent check-ins
				</h2>
				<div className="space-y-2">
					{checkins.map((item) => (
						<CheckInRow key={item.id} item={item} />
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
