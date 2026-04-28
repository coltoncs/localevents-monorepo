import { useNavigate } from "@tanstack/react-router";
import type { Map as MapboxMap } from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import { PlaceMap } from "#/components/PlaceMap";
import { formatCuisineLabel } from "#/lib/cuisines";
import { usePlaces } from "#/lib/hooks/usePlaces";
import type { BarType, Cuisine, Place } from "#/lib/types";

interface FullscreenPlaceMapProps {
	tab: "food" | "drinks";
	lat: number;
	lng: number;
	radius?: number;
	cuisine?: Cuisine[];
	barType?: BarType[];
	minPrice?: number;
	maxPrice?: number;
	search?: string;
	onClose: () => void;
}

const RADIUS_OPTIONS: Array<{ value: number; label: string }> = [
	{ value: 5, label: "5 mi" },
	{ value: 10, label: "10 mi" },
	{ value: 25, label: "25 mi" },
	{ value: 50, label: "50 mi" },
	{ value: 100, label: "100 mi" },
	{ value: 0, label: "All" },
];

export function FullscreenPlaceMap({
	tab,
	lat,
	lng,
	radius,
	cuisine,
	barType,
	minPrice,
	maxPrice,
	search,
	onClose,
}: FullscreenPlaceMapProps) {
	const navigate = useNavigate();
	const [settingOrigin, setSettingOrigin] = useState(false);
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
	const [searchInput, setSearchInput] = useState(search ?? "");
	const mapInstanceRef = useRef<MapboxMap | null>(null);

	const effectiveRadius = radius ?? 10;
	const showAll = effectiveRadius === 0;
	const filters = {
		lat,
		lng,
		radius: showAll ? 25000 : effectiveRadius,
		isFood: tab === "food",
		isDrink: tab === "drinks",
		cuisine: tab === "food" ? cuisine : undefined,
		barType: tab === "drinks" ? barType : undefined,
		minPrice: tab === "food" ? minPrice : undefined,
		maxPrice: tab === "food" ? maxPrice : undefined,
		search,
	};
	const { data, isLoading } = usePlaces(filters);
	const places = data?.places ?? [];

	useEffect(() => {
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = "";
		};
	}, []);

	useEffect(() => {
		setSearchInput(search ?? "");
	}, [search]);

	useEffect(() => {
		const canvas = mapInstanceRef.current?.getCanvas();
		if (!canvas) return;
		canvas.style.cursor = settingOrigin ? "crosshair" : "";
		return () => {
			canvas.style.cursor = "";
		};
	}, [settingOrigin]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: trigger resize on sidebar collapse
	useEffect(() => {
		const map = mapInstanceRef.current;
		if (!map) return;
		let raf = 0;
		const start = performance.now();
		const tick = (t: number) => {
			map.resize();
			if (t - start < 260) raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [sidebarCollapsed]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: clear selection when any filter changes
	useEffect(() => {
		setSelectedPlaceId(null);
	}, [tab, cuisine, barType, minPrice, maxPrice, search, lat, lng, radius]);

	const currentSearch = {
		tab,
		lat,
		lng,
		radius,
		cuisine,
		minPrice,
		maxPrice,
		search,
		fullscreen: 1 as const,
	};

	function handleMapClick(lngLat: { lng: number; lat: number }) {
		if (!settingOrigin) return;
		setSettingOrigin(false);
		navigate({
			to: "/places",
			search: {
				...currentSearch,
				lat: Math.round(lngLat.lat * 1_000_000) / 1_000_000,
				lng: Math.round(lngLat.lng * 1_000_000) / 1_000_000,
			},
			replace: true,
		});
	}

	function setRadius(r: number) {
		navigate({
			to: "/places",
			search: { ...currentSearch, radius: r },
			replace: true,
		});
	}

	function submitSearch(value: string) {
		const trimmed = value.trim();
		navigate({
			to: "/places",
			search: { ...currentSearch, search: trimmed || undefined },
			replace: true,
		});
	}

	function handleSelectPlace(place: Place) {
		setSelectedPlaceId(place.ID);
		mapInstanceRef.current?.flyTo({
			center: [place.Longitude, place.Latitude],
			zoom: 15,
			duration: 900,
		});
	}

	function handleRecenter() {
		mapInstanceRef.current?.flyTo({
			center: [lng, lat],
			zoom: 11,
			duration: 900,
		});
	}

	const filtersNode = (
		<FiltersRow
			radius={effectiveRadius}
			searchInput={searchInput}
			onSearchInputChange={setSearchInput}
			onSubmitSearch={() => submitSearch(searchInput)}
			onClearSearch={() => {
				setSearchInput("");
				submitSearch("");
			}}
			onRadiusChange={setRadius}
			placeholder={
				tab === "food" ? "Search restaurants…" : "Search breweries & bars…"
			}
		/>
	);

	const listNode = (
		<PlaceList
			places={places}
			isLoading={isLoading}
			center={{ lat, lng }}
			selectedPlaceId={selectedPlaceId}
			onSelect={handleSelectPlace}
		/>
	);

	return (
		<div className="fixed inset-0 z-[60] flex h-[100dvh] bg-(--bg-base)">
			<aside
				className={`fullscreen-slide-up relative hidden shrink-0 flex-col border-r border-(--line) bg-(--surface-strong) backdrop-blur-lg transition-[width] duration-200 md:flex ${
					sidebarCollapsed ? "w-0" : "w-[400px]"
				}`}
			>
				{!sidebarCollapsed && (
					<>
						<SidebarHeader tab={tab} count={places.length} />
						{filtersNode}
						<div className="min-h-0 flex-1 overflow-y-auto">{listNode}</div>
					</>
				)}
				<button
					type="button"
					onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
					className="absolute left-full top-6 z-10 flex h-14 w-6 cursor-pointer items-center justify-center rounded-r-md border border-l-0 border-(--line) bg-(--surface-strong) text-(--sea-ink-soft) shadow-lg backdrop-blur-lg hover:text-(--sea-ink)"
					aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
				>
					<svg
						width="12"
						height="12"
						viewBox="0 0 12 12"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
					>
						<title>{sidebarCollapsed ? "Expand" : "Collapse"}</title>
						<path d={sidebarCollapsed ? "M4 2l4 4-4 4" : "M8 2L4 6l4 4"} />
					</svg>
				</button>
			</aside>

			<div className="relative min-w-0 flex-1">
				<PlaceMap
					places={places}
					center={{ lat, lng }}
					radiusMiles={showAll ? 0 : effectiveRadius}
					className="h-full w-full"
					onMapReady={(map) => {
						mapInstanceRef.current = map;
					}}
					onMapClick={handleMapClick}
					selectedPlaceId={selectedPlaceId}
				/>

				<div className="pointer-events-none absolute inset-0">
					<div className="pointer-events-auto absolute top-3 right-3 flex flex-col items-end gap-2">
						<button
							type="button"
							onClick={onClose}
							className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-(--line) bg-(--surface-strong) text-(--sea-ink) shadow-lg backdrop-blur-lg hover:bg-(--link-bg-hover)"
							aria-label="Exit fullscreen"
						>
							<svg
								width="18"
								height="18"
								viewBox="0 0 20 20"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
							>
								<title>Close</title>
								<path d="M15 5L5 15M5 5l10 10" />
							</svg>
						</button>
						<div className="flex flex-col overflow-hidden rounded-lg border border-(--line) bg-(--surface-strong) shadow-lg backdrop-blur-lg">
							<button
								type="button"
								onClick={() => setSettingOrigin(!settingOrigin)}
								className={`flex h-10 w-10 cursor-pointer items-center justify-center ${
									settingOrigin
										? "bg-(--lagoon-deep) text-white"
										: "text-(--sea-ink) hover:bg-(--link-bg-hover)"
								}`}
								aria-label="Set search center"
							>
								<svg
									width="18"
									height="18"
									viewBox="0 0 20 20"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeLinecap="round"
								>
									<title>Set center</title>
									<circle cx="10" cy="10" r="3" />
									<circle cx="10" cy="10" r="7" />
									<path d="M10 1v4M10 15v4M1 10h4M15 10h4" />
								</svg>
							</button>
							<div className="border-t border-(--line)" />
							<button
								type="button"
								onClick={handleRecenter}
								className="flex h-10 w-10 cursor-pointer items-center justify-center text-(--sea-ink) hover:bg-(--link-bg-hover)"
								aria-label="Recenter map"
							>
								<svg
									width="18"
									height="18"
									viewBox="0 0 20 20"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeLinecap="round"
								>
									<title>Recenter</title>
									<circle cx="10" cy="10" r="3" />
									<path d="M10 1v3M10 16v3M1 10h3M16 10h3" />
								</svg>
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function SidebarHeader({
	tab,
	count,
}: {
	tab: "food" | "drinks";
	count: number;
}) {
	return (
		<div className="flex items-center justify-between gap-2 border-b border-(--line) px-4 py-4">
			<div>
				<div className="island-kicker">
					{tab === "food" ? "Food Map" : "Drinks Map"}
				</div>
				<div className="mt-0.5 text-lg font-bold tracking-tight text-(--sea-ink)">
					{count} spot{count !== 1 ? "s" : ""}
				</div>
			</div>
			<div
				className="h-2.5 w-2.5 rounded-full"
				style={{
					background:
						tab === "food"
							? "linear-gradient(90deg,#f59e0b,#d97706)"
							: "linear-gradient(90deg, var(--lagoon), var(--lagoon-deep))",
					boxShadow:
						tab === "food" ? "0 0 10px #f59e0b" : "0 0 10px var(--lagoon)",
				}}
				aria-hidden
			/>
		</div>
	);
}

function FiltersRow({
	radius,
	searchInput,
	onSearchInputChange,
	onSubmitSearch,
	onClearSearch,
	onRadiusChange,
	placeholder,
}: {
	radius: number;
	searchInput: string;
	onSearchInputChange: (v: string) => void;
	onSubmitSearch: () => void;
	onClearSearch: () => void;
	onRadiusChange: (r: number) => void;
	placeholder: string;
}) {
	return (
		<div className="space-y-2 border-b border-(--line) p-3">
			<form
				onSubmit={(e) => {
					e.preventDefault();
					onSubmitSearch();
				}}
				className="flex items-center gap-1.5"
			>
				<input
					type="text"
					value={searchInput}
					onChange={(e) => onSearchInputChange(e.target.value)}
					placeholder={placeholder}
					className="h-9 flex-1 rounded-lg border border-(--line) bg-(--chip-bg) px-3 text-sm text-(--sea-ink) outline-none placeholder:text-(--sea-ink-soft) focus:border-(--lagoon)"
				/>
				{searchInput && (
					<button
						type="button"
						onClick={onClearSearch}
						className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-(--line) bg-(--chip-bg) text-(--sea-ink-soft) hover:border-(--lagoon) hover:text-(--sea-ink)"
						aria-label="Clear search"
					>
						×
					</button>
				)}
			</form>
			<select
				value={radius}
				onChange={(e) => onRadiusChange(Number(e.target.value))}
				className="w-full cursor-pointer rounded-lg border border-(--line) bg-(--chip-bg) px-3 py-2 text-sm text-(--sea-ink) hover:border-(--lagoon)"
			>
				{RADIUS_OPTIONS.map((o) => (
					<option key={o.value} value={o.value}>
						{o.label}
					</option>
				))}
			</select>
		</div>
	);
}

function PlaceList({
	places,
	isLoading,
	center,
	selectedPlaceId,
	onSelect,
}: {
	places: Place[];
	isLoading: boolean;
	center: { lat: number; lng: number };
	selectedPlaceId: string | null;
	onSelect: (p: Place) => void;
}) {
	if (isLoading) {
		return (
			<div className="px-4 py-6">
				{[0, 1, 2].map((i) => (
					<div
						key={i}
						className="mb-3 flex animate-pulse gap-3"
						style={{ animationDelay: `${i * 100}ms` }}
					>
						<div className="h-16 w-16 shrink-0 rounded-md bg-(--line)" />
						<div className="flex-1 space-y-2 py-1">
							<div className="h-3 w-3/4 rounded bg-(--line)" />
							<div className="h-2.5 w-1/2 rounded bg-(--line)" />
							<div className="h-2.5 w-1/3 rounded bg-(--line)" />
						</div>
					</div>
				))}
			</div>
		);
	}
	if (places.length === 0) {
		return (
			<div className="flex h-full flex-col items-center justify-center px-8 py-16 text-center">
				<div className="island-kicker">Nothing nearby</div>
				<div className="mt-2 text-sm font-bold text-(--sea-ink)">No spots</div>
				<div className="mt-1 text-xs text-(--sea-ink-soft)">
					Try a larger radius or different filters.
				</div>
			</div>
		);
	}
	return (
		<ul className="divide-y divide-(--line)">
			{places.map((place) => (
				<PlaceRow
					key={place.ID}
					place={place}
					center={center}
					selected={selectedPlaceId === place.ID}
					onClick={() => onSelect(place)}
				/>
			))}
		</ul>
	);
}

function PlaceRow({
	place,
	center,
	selected,
	onClick,
}: {
	place: Place;
	center: { lat: number; lng: number };
	selected: boolean;
	onClick: () => void;
}) {
	const distance = haversineMiles(
		center.lat,
		center.lng,
		place.Latitude,
		place.Longitude,
	);
	const price = formatPriceLevel(place.PriceLevel);
	const firstTag = place.Tags?.[0];
	const kindLabel = placeKindLabel(place);

	return (
		<li>
			<button
				type="button"
				onClick={onClick}
				className={`group flex w-full cursor-pointer gap-3 px-4 py-3 text-left transition-colors ${
					selected ? "bg-(--link-bg-hover)" : "hover:bg-(--link-bg-hover)"
				}`}
				style={
					selected ? { boxShadow: "inset 3px 0 0 var(--lagoon)" } : undefined
				}
			>
				{place.ImageUrl ? (
					<img
						src={place.ImageUrl}
						alt=""
						loading="lazy"
						className="h-16 w-16 shrink-0 rounded-md border border-(--line) object-cover"
					/>
				) : (
					<div
						className="h-16 w-16 shrink-0 rounded-md border border-(--line)"
						style={{
							background: place.IsFood
								? "linear-gradient(135deg, rgba(245,158,11,0.4), rgba(217,119,6,0.4))"
								: "linear-gradient(135deg, color-mix(in oklab, var(--lagoon) 60%, transparent), var(--lagoon-deep))",
						}}
					/>
				)}
				<div className="min-w-0 flex-1">
					<div className="truncate text-sm font-bold text-(--sea-ink)">
						{place.Name}
					</div>
					<div className="mt-0.5 truncate text-xs text-(--sea-ink-soft)">
						{kindLabel}
						{place.City ? ` · ${place.City}` : ""}
					</div>
					<div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem]">
						<span className="text-(--sea-ink-soft)">
							{distance.toFixed(1)} mi
						</span>
						{price && (
							<span className="font-semibold text-(--sea-ink)">{price}</span>
						)}
						{firstTag && (
							<span className="truncate text-(--sea-ink-soft)">
								· {firstTag}
							</span>
						)}
					</div>
				</div>
			</button>
		</li>
	);
}

function placeKindLabel(place: Place): string {
	const parts: string[] = [];
	if (place.IsFood && place.Cuisine)
		parts.push(formatCuisineLabel(place.Cuisine));
	if (place.IsDrink && place.BarType) {
		parts.push(place.BarType === "brewery" ? "Brewery" : "Bar");
	}
	return parts.join(" · ");
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

function formatPriceLevel(level?: number): string | null {
	if (!level || level <= 0) return null;
	return "$".repeat(Math.min(4, level));
}

export const FullscreenPlaceMapSkeleton = () => (
	<div className="fixed inset-0 z-[60] flex h-[100dvh] bg-(--bg-base)" />
);
