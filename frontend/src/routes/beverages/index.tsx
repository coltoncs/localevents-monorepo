import { useAuth } from "@clerk/clerk-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { BeverageCard } from "#/components/BeverageCard";
import { BeverageMap } from "#/components/BeverageMap";
import { getSavedLocation, LocationSearch } from "#/components/LocationSearch";
import { Spinner } from "#/components/Spinner";
import { SuggestBeverageCreateModal } from "#/components/SuggestBeverageCreateModal";
import { beverageListOptions, useBeverages } from "#/lib/hooks/useBeverages";
import { useUser } from "#/lib/hooks/useUser";

interface BeveragesSearch {
	lat?: number;
	lng?: number;
	radius?: number;
	type?: "brewery" | "bar";
	search?: string;
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
		search: (search.search as string) || undefined,
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
					search: deps.search,
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

const BANNER_STORAGE_KEY = "beverages-banner-dismissed";

function BeverageBanner() {
	const [dismissed, setDismissed] = useState(true);

	useEffect(() => {
		setDismissed(localStorage.getItem(BANNER_STORAGE_KEY) === "1");
	}, []);

	const handleDismiss = useCallback(() => {
		localStorage.setItem(BANNER_STORAGE_KEY, "1");
		setDismissed(true);
	}, []);

	if (dismissed) return null;

	return (
		<div className="flex items-center justify-between gap-3 rounded-lg border border-(--line) bg-[rgba(79,184,178,0.08)] px-4 py-2.5">
			<p className="text-sm text-(--sea-ink)">
				Locations are currently being added manually. Please check back later
				for an expanded listing!
			</p>
			<button
				type="button"
				onClick={handleDismiss}
				className="shrink-0 cursor-pointer rounded-md p-1 text-(--sea-ink-soft) hover:text-(--sea-ink) hover:bg-(--surface)"
				aria-label="Dismiss"
			>
				<svg
					className="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2}
					aria-hidden="true"
				>
					<title>Close</title>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		</div>
	);
}

function BeveragesList({
	search,
}: {
	search: BeveragesSearch & { lat: number; lng: number };
}) {
	const navigate = useNavigate();
	const { isSignedIn } = useAuth();
	const [locationName, setLocationName] = useState<string | null>(null);
	const [showCreateSuggestion, setShowCreateSuggestion] = useState(false);

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
		search: search.search,
	};

	const { data, isLoading } = useBeverages(filters);
	const beverages = data?.beverages ?? [];

	const [searchInput, setSearchInput] = useState(search.search ?? "");

	useEffect(() => {
		setSearchInput(search.search ?? "");
	}, [search.search]);

	function submitSearch(value: string) {
		const trimmed = value.trim();
		navigate({
			to: "/beverages",
			search: (prev) => ({ ...prev, search: trimmed || undefined }),
			replace: true,
		});
	}

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
				<div className="flex items-center gap-3">
					{isSignedIn && (
						<button
							type="button"
							onClick={() => setShowCreateSuggestion(true)}
							className="cursor-pointer whitespace-nowrap rounded-md border border-(--line) bg-(--surface-strong) px-3 py-1.5 text-sm font-medium text-(--sea-ink) hover:bg-(--surface)"
						>
							+ Suggest a spot
						</button>
					)}
					<LocationSearch compact />
				</div>
			</div>

			<BeverageBanner />

			{showCreateSuggestion && (
				<SuggestBeverageCreateModal
					onClose={() => setShowCreateSuggestion(false)}
				/>
			)}

			{/* Filters */}
			<div className="flex flex-wrap items-center gap-3">
				{/* Search */}
				<form
					onSubmit={(e) => {
						e.preventDefault();
						submitSearch(searchInput);
					}}
					className="flex gap-2"
				>
					<input
						type="text"
						value={searchInput}
						onChange={(e) => setSearchInput(e.target.value)}
						placeholder="Search breweries & bars..."
						className="w-full rounded-md border border-(--line) bg-(--surface-strong) px-3 py-1.5 text-sm text-(--sea-ink) sm:w-56"
					/>
					{search.search && (
						<button
							type="button"
							onClick={() => {
								setSearchInput("");
								submitSearch("");
							}}
							className="cursor-pointer rounded-md border border-(--line) px-2 py-1.5 text-sm text-(--sea-ink-soft) hover:bg-(--surface)"
							aria-label="Clear search"
						>
							&times;
						</button>
					)}
				</form>

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
				{search.search && (
					<span className="rounded-full bg-[rgba(123,142,232,0.14)] px-2.5 py-0.5 text-sm font-medium text-(--lagoon-deep)">
						"{search.search}"
					</span>
				)}
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
