import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { LocateFixed } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getCurrentPosition } from "#/lib/geolocation";
import { eventListOptions } from "#/lib/hooks/useEvents";
import { storageGet, storageSet } from "#/lib/storage";
import { toast } from "#/lib/toast";
import type { EventSort } from "#/lib/types";

export const NC_CITIES: Record<string, { lat: number; lng: number }> = {
	Raleigh: { lat: 35.7796, lng: -78.6382 },
	Durham: { lat: 35.994, lng: -78.8986 },
	"Chapel Hill": { lat: 35.9132, lng: -79.0558 },
	"Wake Forest": { lat: 35.97572981255188, lng: -78.51321038126592 },
	Cary: { lat: 35.7915, lng: -78.7811 },
	Clayton: { lat: 35.6507, lng: -78.4564 },
	// Charlotte: { lat: 35.2271, lng: -80.8431 },
	// Greensboro: { lat: 36.0726, lng: -79.792 },
	//   'Winston-Salem': { lat: 36.0999, lng: -80.2442 },
	//   Fayetteville: { lat: 35.0527, lng: -78.8784 },
	// Asheville: { lat: 35.5951, lng: -82.5515 },
	//   Wilmington: { lat: 34.2257, lng: -77.9447 },
};

const VA_CITIES: Record<string, { lat: number; lng: number }> = {
	Richmond: { lat: 37.5407, lng: -77.436 },
	"Virginia Beach": { lat: 36.8516, lng: -75.978 },
	Norfolk: { lat: 36.8508, lng: -76.2859 },
	Charlottesville: { lat: 38.0293, lng: -78.4767 },
	Roanoke: { lat: 37.271, lng: -79.9414 },
};

const SC_CITIES: Record<string, { lat: number; lng: number }> = {
	Charleston: { lat: 32.7765, lng: -79.9311 },
	Columbia: { lat: 34.0007, lng: -81.0348 },
	Greenville: { lat: 34.8526, lng: -82.394 },
	"Myrtle Beach": { lat: 33.6891, lng: -78.8867 },
};

const ALL_CITIES: Record<string, { lat: number; lng: number }> = {
	...NC_CITIES,
	...VA_CITIES,
	...SC_CITIES,
};

export const STORAGE_KEY = "localevents_location";

// Saved-location name for browser geolocation (shared with LocationSearch).
const MY_LOCATION = "My Location";

// City used when the user's own location has no events nearby.
const FALLBACK_CITY = "Raleigh";

export interface SavedLocation {
	name: string;
	lat: number;
	lng: number;
}

export function getSavedLocation(): SavedLocation | null {
	const raw = storageGet(STORAGE_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as SavedLocation;
	} catch {
		return null;
	}
}

export function saveLocation(location: SavedLocation) {
	storageSet(STORAGE_KEY, JSON.stringify(location));
}

export function LocationSearch({
	compact = false,
	navigateTo,
}: {
	compact?: boolean;
	navigateTo?: string;
}) {
	const navigate = useNavigate();
	const location = useLocation();
	const [query, setQuery] = useState("");
	const [geolocating, setGeolocating] = useState(false);
	const [open, setOpen] = useState(false);
	const wrapperRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (
				wrapperRef.current &&
				!wrapperRef.current.contains(e.target as Node)
			) {
				setOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	function go(name: string, lat: number, lng: number) {
		saveLocation({ name, lat, lng });
		navigate({
			to: navigateTo ?? location.pathname,
			search: (prev) => ({ ...prev, lat, lng }),
		});
	}

	function handleGeolocate() {
		if (!navigator.geolocation) return;
		setGeolocating(true);
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				setGeolocating(false);
				go(MY_LOCATION, pos.coords.latitude, pos.coords.longitude);
			},
			() => {
				setGeolocating(false);
			},
			{ timeout: 10000 },
		);
	}

	const [saved, setSaved] = useState<SavedLocation | null>(null);

	useEffect(() => {
		setSaved(getSavedLocation());
	}, []);

	const CITY_GROUPS = [
		{ label: "North Carolina", cities: NC_CITIES },
		// { label: "Virginia", cities: VA_CITIES },
		// { label: "South Carolina", cities: SC_CITIES },
	];

	const q = query.trim().toLowerCase();
	const filteredGroups = CITY_GROUPS.map((group) => ({
		...group,
		cities: Object.keys(group.cities).filter(
			(name) => !q || name.toLowerCase().startsWith(q),
		),
	})).filter((group) => group.cities.length > 0);

	const matchingCities = filteredGroups.flatMap((g) => g.cities);

	function handleCitySelect(city: string) {
		const coords = ALL_CITIES[city];
		if (coords) {
			setQuery("");
			setOpen(false);
			go(city, coords.lat, coords.lng);
		}
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (matchingCities.length >= 1) {
			handleCitySelect(matchingCities[0]);
		}
	}

	return (
		<div className="w-full max-w-md">
			<form onSubmit={handleSubmit} className="flex gap-2">
				<div ref={wrapperRef} className="relative flex-1">
					<input
						type="text"
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setOpen(true);
						}}
						onFocus={() => setOpen(true)}
						placeholder="Search a city..."
						className={`w-full rounded-md border border-(--line) px-4 text-sm bg-(--surface-strong) focus:border-(--lagoon) focus:ring-1 focus:ring-(--lagoon) focus:outline-none ${compact ? "py-2" : "py-2.5"}`}
					/>
					{open && filteredGroups.length > 0 && (
						<ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-(--line) bg-(--surface-strong) py-1 shadow-lg">
							{filteredGroups.map((group) => (
								<li key={group.label}>
									<div className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
										{group.label}
									</div>
									<ul>
										{group.cities.map((city) => (
											<li key={city}>
												<button
													type="button"
													onClick={() => handleCitySelect(city)}
													className="w-full px-6 py-1.5 text-left text-sm text-(--sea-ink-soft) hover:bg-[rgba(79,184,178,0.08)] hover:text-(--lagoon-deep)"
												>
													{city}
												</button>
											</li>
										))}
									</ul>
								</li>
							))}
						</ul>
					)}
				</div>

				<button
					type="button"
					onClick={handleGeolocate}
					disabled={geolocating}
					title="Use my location"
					className="rounded-md border border-(--line) bg-(--surface-strong) px-3 py-2 text-sm text-(--sea-ink-soft) disabled:opacity-50 cursor-pointe hover:border-(--lagoon) hover:bg-(--link-bg-hover)"
				>
					{geolocating ? "..." : "\u{1F4CD}"}
				</button>
			</form>

			{saved && !compact && (
				<button
					type="button"
					onClick={() => go(saved.name, saved.lat, saved.lng)}
					className="mt-2 text-sm text-(--lagoon-deep) hover:text-(--lagoon)"
				>
					Use recent: {saved.name}
				</button>
			)}
		</div>
	);
}

function sameCoords(aLat: number, aLng: number, bLat: number, bLng: number) {
	return Math.abs(aLat - bLat) < 0.001 && Math.abs(aLng - bLng) < 0.001;
}

export function CityButtons({
	lat,
	lng,
	radius,
	navigateTo,
}: {
	lat?: number;
	lng?: number;
	radius?: number;
	navigateTo?: string;
}) {
	const navigate = useNavigate();
	const location = useLocation();
	const queryClient = useQueryClient();
	const [locating, setLocating] = useState(false);
	// Read after mount: storage isn't available during SSR.
	const [saved, setSaved] = useState<SavedLocation | null>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-read storage whenever the location changes, since go() saves before navigating
	useEffect(() => {
		setSaved(getSavedLocation());
	}, [lat, lng]);

	const nearMeActive =
		saved?.name === MY_LOCATION &&
		lat !== undefined &&
		lng !== undefined &&
		sameCoords(lat, lng, saved.lat, saved.lng);

	function go(
		name: string,
		cityLat: number,
		cityLng: number,
		sort?: EventSort,
	) {
		saveLocation({ name, lat: cityLat, lng: cityLng });
		navigate({
			to: navigateTo ?? location.pathname,
			search: (prev) => ({
				...prev,
				lat: cityLat,
				lng: cityLng,
				page: undefined,
				...(sort ? { sort } : {}),
			}),
		});
	}

	// Geolocates the user, then lists events nearest-first. If nothing is within
	// the current radius (e.g. they're outside our coverage area), falls back to
	// Raleigh rather than showing an empty list.
	async function goNearMe() {
		setLocating(true);
		try {
			const coords = await getCurrentPosition();
			// ~100m precision: plenty for sorting, and keeps exact coordinates out
			// of shareable URLs.
			const myLat = Math.round(coords.latitude * 1000) / 1000;
			const myLng = Math.round(coords.longitude * 1000) / 1000;

			const { total } = await queryClient.fetchQuery(
				eventListOptions({ lat: myLat, lng: myLng, radius, limit: 1 }),
			);
			if (total === 0) {
				const city = NC_CITIES[FALLBACK_CITY];
				toast(
					`No events near your location yet, so we're showing ${FALLBACK_CITY} instead.`,
				);
				go(FALLBACK_CITY, city.lat, city.lng);
				return;
			}
			go(MY_LOCATION, myLat, myLng, "distance");
		} catch (err) {
			const denied =
				typeof GeolocationPositionError !== "undefined" &&
				err instanceof GeolocationPositionError &&
				err.code === err.PERMISSION_DENIED;
			toast(
				denied
					? "Location access is blocked. Allow it in your browser settings to see events near you."
					: "Couldn't get your location. Please try again.",
			);
		} finally {
			setLocating(false);
		}
	}

	return (
		<fieldset className="flex flex-wrap gap-2">
			<legend className="sr-only">City</legend>
			<button
				type="button"
				onClick={() => !nearMeActive && !locating && goNearMe()}
				aria-pressed={nearMeActive}
				aria-busy={locating}
				disabled={locating}
				className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium disabled:cursor-wait disabled:opacity-70 ${
					nearMeActive
						? "border-(--lagoon-deep) bg-(--lagoon-deep) text-white"
						: "border-(--line) bg-(--surface-strong) text-(--sea-ink-soft) hover:border-(--lagoon) hover:text-(--lagoon-deep)"
				}`}
			>
				<LocateFixed
					size={14}
					aria-hidden="true"
					className={locating ? "animate-pulse" : undefined}
				/>
				{locating ? "Locating…" : "Near Me"}
			</button>
			{Object.entries(NC_CITIES).map(([name, coords]) => {
				const active =
					lat !== undefined &&
					lng !== undefined &&
					sameCoords(lat, lng, coords.lat, coords.lng);
				return (
					<button
						key={name}
						type="button"
						onClick={() => !active && go(name, coords.lat, coords.lng)}
						aria-pressed={active}
						className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium ${
							active
								? "border-(--lagoon-deep) bg-(--lagoon-deep) text-white"
								: "border-(--line) bg-(--surface-strong) text-(--sea-ink-soft) hover:border-(--lagoon) hover:text-(--lagoon-deep)"
						}`}
					>
						{name}
					</button>
				);
			})}
		</fieldset>
	);
}
