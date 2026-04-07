import { useAuth } from "@clerk/clerk-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BeverageCard } from "#/components/BeverageCard";
import { BeverageMap } from "#/components/BeverageMap";
import { getSavedLocation, LocationSearch } from "#/components/LocationSearch";
import { Spinner } from "#/components/Spinner";
import { beverageListOptions, useBeverages } from "#/lib/hooks/useBeverages";
import { useUser } from "#/lib/hooks/useUser";

interface BeveragesSearch {
	lat?: number;
	lng?: number;
	radius?: number;
	type?: "brewery" | "bar";
}

export const Route = createFileRoute("/beverages/")({
	head: () => ({
		meta: [
			{ title: "Breweries & Bars | 919Events" },
			{
				name: "description",
				content:
					"Discover local breweries and bars near you on an interactive map.",
			},
			{ property: "og:title", content: "Breweries & Bars | 919Events" },
			{
				property: "og:description",
				content:
					"Discover local breweries and bars near you on an interactive map.",
			},
		],
		links: [{ rel: "canonical", href: "https://919events.com/beverages" }],
	}),
	validateSearch: (search: Record<string, unknown>): BeveragesSearch => ({
		lat: search.lat ? Number(search.lat) : undefined,
		lng: search.lng ? Number(search.lng) : undefined,
		radius: search.radius ? Number(search.radius) : undefined,
		type: ["brewery", "bar"].includes(search.type as string)
			? (search.type as "brewery" | "bar")
			: undefined,
	}),
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		if (deps.lat && deps.lng) {
			await context.queryClient.prefetchQuery(
				beverageListOptions({
					lat: deps.lat,
					lng: deps.lng,
					radius: deps.radius,
					type: deps.type,
				}),
			);
		}
	},
	component: BeveragesPage,
});

function BeveragesPage() {
	const search = Route.useSearch();
	const navigate = useNavigate();
	const { isSignedIn } = useAuth();
	const { data: user } = useUser();

	useEffect(() => {
		if (search.lat && search.lng) return;

		const saved = getSavedLocation();
		if (saved) {
			navigate({
				to: "/beverages",
				search: { lat: saved.lat, lng: saved.lng },
				replace: true,
			});
			return;
		}

		if (isSignedIn && user?.DefaultLatitude && user?.DefaultLongitude) {
			navigate({
				to: "/beverages",
				search: {
					lat: user.DefaultLatitude,
					lng: user.DefaultLongitude,
					radius: user.DefaultRadiusMiles,
				},
				replace: true,
			});
		}
	}, [search.lat, search.lng, navigate, isSignedIn, user]);

	if (!search.lat || !search.lng) {
		return (
			<div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
				<h1 className="text-2xl font-bold text-(--sea-ink)">
					Breweries & Bars
				</h1>
				<div className="flex flex-col items-center gap-4 py-16">
					<p className="text-(--sea-ink-soft)">
						Search for a city to find breweries and bars near you.
					</p>
					<LocationSearch />
				</div>
			</div>
		);
	}

	return (
		<BeveragesList search={{ ...search, lat: search.lat, lng: search.lng }} />
	);
}

function BeveragesList({
	search,
}: {
	search: BeveragesSearch & { lat: number; lng: number };
}) {
	const navigate = useNavigate();
	const [locationName, setLocationName] = useState<string | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: re-read location name when coords change
	useEffect(() => {
		const saved = getSavedLocation();
		if (saved) setLocationName(saved.name);
	}, [search.lat, search.lng]);

	const center = { lat: search.lat, lng: search.lng };
	const radius = search.radius ?? 10;

	const filters = {
		lat: search.lat,
		lng: search.lng,
		radius,
		type: search.type,
	};

	const { data, isLoading } = useBeverages(filters);
	const beverages = data?.beverages ?? [];

	function setType(type: "brewery" | "bar" | undefined) {
		navigate({
			to: "/beverages",
			search: (prev) => ({ ...prev, type }),
			replace: true,
		});
	}

	function setRadius(r: number) {
		navigate({
			to: "/beverages",
			search: (prev) => ({ ...prev, radius: r }),
			replace: true,
		});
	}

	return (
		<div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
			{/* Header */}
			<div className="flex flex-wrap items-center justify-between gap-4">
				<h1 className="text-2xl font-bold text-(--sea-ink)">
					Breweries & Bars
				</h1>
				<LocationSearch compact />
			</div>

			{/* Filters */}
			<div className="flex flex-wrap items-center gap-3">
				{/* Type toggle */}
				<div className="flex rounded-lg border border-(--line) p-0.5">
					<button
						type="button"
						onClick={() => setType(undefined)}
						className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
							!search.type
								? "bg-(--lagoon) text-white"
								: "text-(--sea-ink-soft) hover:text-(--sea-ink)"
						}`}
					>
						All
					</button>
					<button
						type="button"
						onClick={() => setType("brewery")}
						className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
							search.type === "brewery"
								? "bg-(--lagoon) text-white"
								: "text-(--sea-ink-soft) hover:text-(--sea-ink)"
						}`}
					>
						Breweries
					</button>
					<button
						type="button"
						onClick={() => setType("bar")}
						className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
							search.type === "bar"
								? "bg-(--lagoon) text-white"
								: "text-(--sea-ink-soft) hover:text-(--sea-ink)"
						}`}
					>
						Bars
					</button>
				</div>

				{/* Radius selector */}
				<select
					value={radius}
					onChange={(e) => setRadius(Number(e.target.value))}
					className="cursor-pointer rounded-lg border border-(--line) bg-(--surface-strong) px-3 py-1.5 text-sm text-(--sea-ink)"
				>
					<option value={5}>5 mi</option>
					<option value={10}>10 mi</option>
					<option value={25}>25 mi</option>
					<option value={50}>50 mi</option>
					<option value={100}>100 mi</option>
				</select>

				{/* Active filter summary */}
				{locationName && (
					<span className="rounded-full bg-[rgba(123,142,232,0.14)] px-2.5 py-0.5 text-sm font-medium text-(--lagoon-deep)">
						{locationName}
					</span>
				)}
				<span className="text-sm text-(--sea-ink-soft)">
					{beverages.length} result{beverages.length !== 1 ? "s" : ""}
				</span>
			</div>

			{/* Map */}
			<BeverageMap
				beverages={beverages}
				center={center}
				radiusMiles={radius}
				className="h-[450px] w-full rounded-lg sm:h-[500px]"
			/>

			{/* Cards */}
			{isLoading ? (
				<Spinner className="py-12" />
			) : beverages.length === 0 ? (
				<div className="py-12 text-center text-(--sea-ink-soft)">
					<p className="text-lg font-medium">
						No{" "}
						{search.type
							? search.type === "brewery"
								? "breweries"
								: "bars"
							: "results"}{" "}
						found in this area.
					</p>
					<p className="mt-1 text-sm">
						Try expanding the radius or searching a different location.
					</p>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{beverages.map((bev) => (
						<BeverageCard key={bev.ID} beverage={bev} />
					))}
				</div>
			)}
		</div>
	);
}
