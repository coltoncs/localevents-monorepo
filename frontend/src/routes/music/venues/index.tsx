import { useAuth } from "@clerk/clerk-react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
	getSavedLocation,
	LocationSearch,
} from "#/components/maps/LocationSearch";
import { VenueCard } from "#/components/music/VenueCard";
import { Spinner } from "#/components/Spinner";
import { useUser } from "#/lib/hooks/useUser";
import { musicVenueListOptions, useMusicVenues } from "#/lib/hooks/useVenues";
import { DEFAULT_MAP_CENTER } from "#/lib/mapUtils";

const DEFAULT_RADIUS = 50;

interface VenuesSearch {
	lat?: number;
	lng?: number;
	radius?: number;
}

export const Route = createFileRoute("/music/venues/")({
	head: () => ({
		meta: [
			{ title: "Music Venues | 919Events" },
			{
				name: "description",
				content:
					"Discover music venues near you and connect with them. Venues can list a profile to receive booking requests from local artists.",
			},
			{ property: "og:title", content: "Music Venues | 919Events" },
		],
		links: [{ rel: "canonical", href: "https://919events.com/music/venues" }],
	}),
	validateSearch: (search: Record<string, unknown>): VenuesSearch => ({
		lat: search.lat ? Number(search.lat) : undefined,
		lng: search.lng ? Number(search.lng) : undefined,
		radius: search.radius ? Number(search.radius) : undefined,
	}),
	loaderDeps: ({ search }) => ({
		lat: search.lat,
		lng: search.lng,
		radius: search.radius,
	}),
	loader: async ({ context, deps }) => {
		if (!deps.lat || !deps.lng) return;
		await context.queryClient.prefetchQuery(
			musicVenueListOptions({
				lat: deps.lat,
				lng: deps.lng,
				radius: deps.radius ?? DEFAULT_RADIUS,
			}),
		);
	},
	component: VenuesPage,
});

function VenuesPage() {
	const search = Route.useSearch();
	const navigate = useNavigate();
	const { isSignedIn } = useAuth();
	const { data: user } = useUser();
	const [nameFilter, setNameFilter] = useState("");

	// Resolve a location the same way the other Music pages do.
	useEffect(() => {
		if (search.lat && search.lng) return;

		const saved = getSavedLocation();
		if (saved) {
			navigate({
				to: "/music/venues",
				search: (prev) => ({ ...prev, lat: saved.lat, lng: saved.lng }),
				replace: true,
			});
			return;
		}

		if (isSignedIn && user?.DefaultLatitude && user?.DefaultLongitude) {
			navigate({
				to: "/music/venues",
				search: (prev) => ({
					...prev,
					lat: user.DefaultLatitude,
					lng: user.DefaultLongitude,
					radius: user.DefaultRadiusMiles,
				}),
				replace: true,
			});
		}
	}, [search.lat, search.lng, navigate, isSignedIn, user]);

	const lat = search.lat ?? DEFAULT_MAP_CENTER.lat;
	const lng = search.lng ?? DEFAULT_MAP_CENTER.lng;
	const radius = search.radius ?? DEFAULT_RADIUS;

	const { data, isLoading } = useMusicVenues({ lat, lng, radius }, true);
	const allVenues = data?.venues ?? [];
	const q = nameFilter.trim().toLowerCase();
	const venues = q
		? allVenues.filter(
				(v) =>
					v.VenueName.toLowerCase().includes(q) ||
					(v.City ?? "").toLowerCase().includes(q),
			)
		: allVenues;

	return (
		<div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-(--sea-ink)">Music Venues</h1>
					<p className="text-sm text-(--sea-ink-soft)">
						Venues hosting live music near you
					</p>
				</div>
				<LocationSearch compact />
			</div>

			<div className="flex flex-wrap items-center gap-3 rounded-lg border border-(--line) bg-(--surface-strong) p-4">
				<input
					type="text"
					value={nameFilter}
					onChange={(e) => setNameFilter(e.target.value)}
					placeholder="Filter by name or city..."
					className="w-full rounded-md border border-(--line) px-3 py-2 text-sm sm:w-64"
				/>
				<select
					value={radius}
					onChange={(e) =>
						navigate({
							to: "/music/venues",
							search: (prev) => ({ ...prev, radius: Number(e.target.value) }),
							replace: true,
						})
					}
					className="w-full rounded-md border border-(--line) px-3 py-2 text-sm sm:w-auto"
				>
					{[10, 25, 50, 100].map((r) => (
						<option key={r} value={r}>
							{r} miles
						</option>
					))}
				</select>
				<Link
					to="/music/venues/claim"
					className="ml-auto rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-medium text-(--foam) hover:opacity-90"
				>
					List your venue
				</Link>
			</div>

			{isLoading ? (
				<Spinner className="py-12" />
			) : venues.length === 0 ? (
				<div className="rounded-lg border border-(--line) bg-(--surface-strong) px-4 py-16 text-center">
					<p className="text-(--sea-ink)">No music venues found nearby.</p>
					<p className="mt-1 text-sm text-(--sea-ink-soft)">
						Try widening the distance, or{" "}
						<Link
							to="/music/venues/claim"
							className="font-medium text-(--lagoon-deep) hover:underline"
						>
							list your venue
						</Link>
						.
					</p>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{venues.map((venue) => (
						<VenueCard key={venue.ID} venue={venue} />
					))}
				</div>
			)}
		</div>
	);
}
