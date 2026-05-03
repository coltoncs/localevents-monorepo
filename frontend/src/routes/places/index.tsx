import { useAuth } from "@clerk/clerk-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { FullscreenPlaceMap } from "#/components/maps/FullscreenPlaceMap";
import { getSavedLocation, LocationSearch } from "#/components/maps/LocationSearch";
import { PlaceCard } from "#/components/places/PlaceCard";
import { PlaceMap } from "#/components/maps/PlaceMap";
import { Spinner } from "#/components/Spinner";
import { SuggestPlaceCreateModal } from "#/components/places/SuggestPlaceCreateModal";
import {
	CUISINES,
	formatCuisineLabel,
	isCuisine,
	isKnownCuisine,
} from "#/lib/cuisines";
import { placeListOptions, usePlaces } from "#/lib/hooks/usePlaces";
import { useUser } from "#/lib/hooks/useUser";
import type { BarType, Cuisine } from "#/lib/types";

type PlacesView = "food" | "drinks";

interface PlacesSearch {
	tab: PlacesView;
	lat?: number;
	lng?: number;
	radius?: number;
	search?: string;
	fullscreen?: 1;
	type?: BarType;
	cuisine?: Cuisine[];
	minPrice?: number;
	maxPrice?: number;
}

function parseCuisineParam(raw: unknown): Cuisine[] | undefined {
	if (!raw) return undefined;
	const arr = Array.isArray(raw) ? raw : [raw];
	const out = arr.filter(isCuisine);
	return out.length > 0 ? out : undefined;
}

export const Route = createFileRoute("/places/")({
	head: () => ({
		meta: [
			{ title: "Food & Drinks | 919Events" },
			{
				name: "description",
				content:
					"Discover local restaurants, breweries, and bars near you on an interactive map.",
			},
			{ property: "og:title", content: "Food & Drinks | 919Events" },
			{
				property: "og:description",
				content:
					"Discover local restaurants, breweries, and bars near you on an interactive map.",
			},
		],
		links: [{ rel: "canonical", href: "https://919events.com/places" }],
	}),
	validateSearch: (search: Record<string, unknown>): PlacesSearch => {
		const tabRaw = search.tab;
		const tab: PlacesView = tabRaw === "food" ? "food" : "drinks";
		return {
			tab,
			lat: search.lat ? Number(search.lat) : undefined,
			lng: search.lng ? Number(search.lng) : undefined,
			radius:
				search.radius !== undefined && search.radius !== ""
					? Number(search.radius)
					: undefined,
			search: (search.search as string) || undefined,
			fullscreen: search.fullscreen ? 1 : undefined,
			type: ["brewery", "bar"].includes(search.type as string)
				? (search.type as BarType)
				: undefined,
			cuisine: parseCuisineParam(search.cuisine),
			minPrice:
				search.minPrice !== undefined && search.minPrice !== ""
					? Number(search.minPrice)
					: undefined,
			maxPrice:
				search.maxPrice !== undefined && search.maxPrice !== ""
					? Number(search.maxPrice)
					: undefined,
		};
	},
	loaderDeps: ({ search }) => ({
		tab: search.tab,
		lat: search.lat,
		lng: search.lng,
		radius: search.radius,
		type: search.type,
		search: search.search,
		cuisine: search.cuisine,
		minPrice: search.minPrice,
		maxPrice: search.maxPrice,
	}),
	loader: async ({ context, deps }) => {
		if (!deps.lat || !deps.lng) return;
		const isFood = deps.tab === "food";
		await context.queryClient.prefetchQuery(
			placeListOptions({
				lat: deps.lat,
				lng: deps.lng,
				radius: deps.radius,
				isFood,
				isDrink: !isFood,
				cuisine: isFood ? deps.cuisine : undefined,
				barType: !isFood && deps.type ? [deps.type] : undefined,
				minPrice: isFood ? deps.minPrice : undefined,
				maxPrice: isFood ? deps.maxPrice : undefined,
				search: deps.search,
			}),
		);
	},
	pendingComponent: function PlacesPending() {
		return <Spinner className="py-24" />;
	},
	component: PlacesPage,
});

function PlacesPage() {
	const search = Route.useSearch();
	const navigate = useNavigate();
	const { isSignedIn } = useAuth();
	const { data: user } = useUser();

	useEffect(() => {
		if (search.lat && search.lng) return;

		const saved = getSavedLocation();
		if (saved) {
			navigate({
				to: "/places",
				search: { tab: search.tab, lat: saved.lat, lng: saved.lng },
				replace: true,
			});
			return;
		}

		if (isSignedIn && user?.DefaultLatitude && user?.DefaultLongitude) {
			navigate({
				to: "/places",
				search: {
					tab: search.tab,
					lat: user.DefaultLatitude,
					lng: user.DefaultLongitude,
					radius: user.DefaultRadiusMiles,
				},
				replace: true,
			});
		}
	}, [search.lat, search.lng, search.tab, navigate, isSignedIn, user]);

	if (!search.lat || !search.lng) {
		return (
			<div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
				<PageHeader tab={search.tab} />
				<div className="flex flex-col items-center gap-4 py-16">
					<p className="text-(--sea-ink-soft)">
						Search for a city to find{" "}
						{search.tab === "food" ? "restaurants" : "breweries and bars"} near
						you.
					</p>
					<LocationSearch />
				</div>
			</div>
		);
	}

	return (
		<PlacesList search={{ ...search, lat: search.lat, lng: search.lng }} />
	);
}

function PageHeader({ tab }: { tab: PlacesView }) {
	return (
		<h1 className="text-2xl font-bold text-(--sea-ink)">
			{tab === "food" ? "Restaurants" : "Breweries & Bars"}
		</h1>
	);
}

function PlacesViewToggle({ tab }: { tab: PlacesView }) {
	const navigate = useNavigate();
	const search = Route.useSearch();
	function setTab(v: PlacesView) {
		navigate({
			to: "/places",
			search: {
				...search,
				tab: v,
				type: undefined,
				cuisine: undefined,
				minPrice: undefined,
				maxPrice: undefined,
			},
			replace: true,
		});
	}
	return (
		<div className="flex rounded-lg border border-(--line) p-0.5">
			<button
				type="button"
				onClick={() => setTab("food")}
				className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
					tab === "food"
						? "bg-(--lagoon) text-white"
						: "text-(--sea-ink-soft) hover:text-(--sea-ink)"
				}`}
			>
				Food
			</button>
			<button
				type="button"
				onClick={() => setTab("drinks")}
				className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
					tab === "drinks"
						? "bg-(--lagoon) text-white"
						: "text-(--sea-ink-soft) hover:text-(--sea-ink)"
				}`}
			>
				Drinks
			</button>
		</div>
	);
}

const BANNER_STORAGE_KEY = "places-banner-dismissed";

function PlacesBanner() {
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

function PlacesList({
	search,
}: {
	search: PlacesSearch & { lat: number; lng: number };
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
	const showAll = radius === 0;
	const effectiveRadius = showAll ? 25000 : radius;

	const isFoodTab = search.tab === "food";
	const filters = {
		lat: search.lat,
		lng: search.lng,
		radius: effectiveRadius,
		isFood: isFoodTab,
		isDrink: !isFoodTab,
		cuisine: isFoodTab ? search.cuisine : undefined,
		barType: !isFoodTab && search.type ? [search.type] : undefined,
		minPrice: isFoodTab ? search.minPrice : undefined,
		maxPrice: isFoodTab ? search.maxPrice : undefined,
		search: search.search,
	};
	const { data, isLoading } = usePlaces(filters);
	const places = data?.places ?? [];
	const resultCount = places.length;

	const [searchInput, setSearchInput] = useState(search.search ?? "");

	useEffect(() => {
		setSearchInput(search.search ?? "");
	}, [search.search]);

	function submitSearch(value: string) {
		const trimmed = value.trim();
		navigate({
			to: "/places",
			search: { ...search, search: trimmed || undefined },
			replace: true,
		});
	}

	function setType(type: BarType | undefined) {
		navigate({
			to: "/places",
			search: { ...search, type },
			replace: true,
		});
	}

	function toggleCuisine(c: Cuisine) {
		const current = search.cuisine ?? [];
		const next = current.includes(c)
			? current.filter((x) => x !== c)
			: [...current, c];
		navigate({
			to: "/places",
			search: { ...search, cuisine: next.length > 0 ? next : undefined },
			replace: true,
		});
	}

	function setPriceBound(
		field: "minPrice" | "maxPrice",
		v: number | undefined,
	) {
		navigate({
			to: "/places",
			search: { ...search, [field]: v },
			replace: true,
		});
	}

	function setRadius(r: number) {
		navigate({
			to: "/places",
			search: { ...search, radius: r },
			replace: true,
		});
	}

	return (
		<div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
			{/* Header */}
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div className="flex items-center gap-4">
					<PageHeader tab={search.tab} />
					<PlacesViewToggle tab={search.tab} />
				</div>
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

			<PlacesBanner />

			{showCreateSuggestion && (
				<SuggestPlaceCreateModal
					onClose={() => setShowCreateSuggestion(false)}
				/>
			)}

			{/* Filters */}
			<div className="flex flex-wrap items-center gap-3">
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
						placeholder={
							isFoodTab ? "Search restaurants..." : "Search breweries & bars..."
						}
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

				{!isFoodTab ? (
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
				) : (
					<FoodFiltersRow
						cuisine={search.cuisine}
						minPrice={search.minPrice}
						maxPrice={search.maxPrice}
						customCuisines={Array.from(
							new Set(
								places
									.map((p) => p.Cuisine)
									.filter((c): c is string => !!c && !isKnownCuisine(c)),
							),
						)}
						onToggleCuisine={toggleCuisine}
						onSetPriceBound={setPriceBound}
					/>
				)}

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
					<option value={0}>All locations</option>
				</select>

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
					{resultCount} result{resultCount !== 1 ? "s" : ""}
				</span>
			</div>

			{/* Map */}
			<div className="relative">
				<PlaceMap
					places={places}
					center={center}
					radiusMiles={showAll ? 0 : radius}
					className="h-[450px] w-full rounded-lg sm:h-[500px]"
				/>
				<button
					type="button"
					onClick={() =>
						navigate({
							to: "/places",
							search: { ...search, fullscreen: 1 },
						})
					}
					className="absolute top-3 left-3 z-20 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-(--line) bg-(--surface-strong) text-(--sea-ink) shadow-lg backdrop-blur-lg hover:bg-(--surface)"
					aria-label="Fullscreen map"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<title>Fullscreen</title>
						<path d="M10 2h4v4M6 14H2v-4M14 2l-5 5M2 14l5-5" />
					</svg>
				</button>
			</div>

			{search.fullscreen && (
				<FullscreenPlaceMap
					tab={search.tab}
					lat={search.lat}
					lng={search.lng}
					radius={search.radius}
					cuisine={search.cuisine}
					barType={search.type ? [search.type] : undefined}
					minPrice={search.minPrice}
					maxPrice={search.maxPrice}
					search={search.search}
					onClose={() =>
						navigate({
							to: "/places",
							search: { ...search, fullscreen: undefined },
						})
					}
				/>
			)}

			{/* Cards */}
			{isLoading ? (
				<Spinner className="py-12" />
			) : resultCount === 0 ? (
				<div className="py-12 text-center text-(--sea-ink-soft)">
					<p className="text-lg font-medium">No results found in this area.</p>
					<p className="mt-1 text-sm">
						Try expanding the radius or searching a different location.
					</p>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{places.map((p) => (
						<PlaceCard key={p.ID} place={p} />
					))}
				</div>
			)}
		</div>
	);
}

function fuzzyMatch(query: string, target: string): boolean {
	const q = query.toLowerCase().replace(/[^a-z0-9]/g, "");
	const t = target.toLowerCase().replace(/[^a-z0-9]/g, "");
	if (!q) return true;
	if (t.includes(q)) return true;
	let i = 0;
	for (const ch of t) {
		if (ch === q[i]) i++;
		if (i === q.length) return true;
	}
	return false;
}

function FoodFiltersRow({
	cuisine,
	minPrice,
	maxPrice,
	customCuisines,
	onToggleCuisine,
	onSetPriceBound,
}: {
	cuisine?: Cuisine[];
	minPrice?: number;
	maxPrice?: number;
	customCuisines: Cuisine[];
	onToggleCuisine: (c: Cuisine) => void;
	onSetPriceBound: (
		field: "minPrice" | "maxPrice",
		v: number | undefined,
	) => void;
}) {
	const [open, setOpen] = useState(false);
	const [cuisineQuery, setCuisineQuery] = useState("");
	const activeCount = cuisine?.length ?? 0;

	const activeCustom = (cuisine ?? [])
		.filter((c) => !isKnownCuisine(c))
		.map((c) => ({ value: c, label: formatCuisineLabel(c) }));
	const customMatches = cuisineQuery
		? customCuisines
				.map((c) => ({ value: c, label: formatCuisineLabel(c) }))
				.filter(
					(c) =>
						fuzzyMatch(cuisineQuery, c.label) ||
						fuzzyMatch(cuisineQuery, c.value),
				)
				.slice(0, 12)
		: [];

	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className={`cursor-pointer rounded-md border border-(--line) bg-(--surface-strong) px-3 py-1.5 text-sm font-medium text-(--sea-ink) hover:bg-(--surface) ${
					activeCount > 0 ? "border-(--lagoon)" : ""
				}`}
			>
				Cuisine{activeCount > 0 ? ` (${activeCount})` : ""}
			</button>
			{open && (
				<div className="absolute top-full z-30 mt-1 w-72 space-y-3 rounded-lg border border-(--line) bg-(--surface-strong) p-3 shadow-lg">
					<div>
						<div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
							Cuisine
						</div>
						<div className="flex flex-wrap gap-1.5">
							{[...CUISINES, ...activeCustom].map((c) => {
								const active = cuisine?.includes(c.value) ?? false;
								return (
									<button
										key={c.value}
										type="button"
										onClick={() => onToggleCuisine(c.value)}
										className={`cursor-pointer rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
											active
												? "bg-(--lagoon) text-white"
												: "border border-(--line) bg-(--surface) text-(--sea-ink-soft) hover:text-(--sea-ink)"
										}`}
									>
										{c.label}
									</button>
								);
							})}
						</div>
						<input
							type="text"
							value={cuisineQuery}
							onChange={(e) => setCuisineQuery(e.target.value)}
							placeholder="Search for another cuisine…"
							className="mt-2 w-full rounded-md border border-(--line) bg-(--surface) px-2 py-1 text-xs text-(--sea-ink) placeholder:text-(--sea-ink-soft)"
						/>
						{cuisineQuery && (
							<div className="mt-1.5 flex flex-wrap gap-1.5">
								{customMatches.length === 0 ? (
									<p className="text-xs text-(--sea-ink-soft)">No matches.</p>
								) : (
									customMatches.map((c) => {
										const active = cuisine?.includes(c.value) ?? false;
										return (
											<button
												key={c.value}
												type="button"
												onClick={() => onToggleCuisine(c.value)}
												className={`cursor-pointer rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
													active
														? "bg-(--lagoon) text-white"
														: "border border-(--line) bg-(--surface) text-(--sea-ink-soft) hover:text-(--sea-ink)"
												}`}
											>
												{c.label}
											</button>
										);
									})
								)}
							</div>
						)}
					</div>
					<div>
						<div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
							Budget
						</div>
						<div className="flex items-center gap-2">
							<select
								value={minPrice ?? ""}
								onChange={(e) =>
									onSetPriceBound(
										"minPrice",
										e.target.value ? Number(e.target.value) : undefined,
									)
								}
								className="flex-1 cursor-pointer rounded-md border border-(--line) bg-(--surface) px-2 py-1 text-sm text-(--sea-ink)"
							>
								<option value="">Min $</option>
								<option value="1">$</option>
								<option value="2">$$</option>
								<option value="3">$$$</option>
								<option value="4">$$$$</option>
							</select>
							<span className="text-sm text-(--sea-ink-soft)">to</span>
							<select
								value={maxPrice ?? ""}
								onChange={(e) =>
									onSetPriceBound(
										"maxPrice",
										e.target.value ? Number(e.target.value) : undefined,
									)
								}
								className="flex-1 cursor-pointer rounded-md border border-(--line) bg-(--surface) px-2 py-1 text-sm text-(--sea-ink)"
							>
								<option value="">Max $$$$</option>
								<option value="1">$</option>
								<option value="2">$$</option>
								<option value="3">$$$</option>
								<option value="4">$$$$</option>
							</select>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
