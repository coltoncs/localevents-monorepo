import { useAuth } from "@clerk/clerk-react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
	getSavedLocation,
	LocationSearch,
} from "#/components/maps/LocationSearch";
import { ArtistCard } from "#/components/music/ArtistCard";
import { MUSIC_GENRES } from "#/components/music/ConcertFilters";
import { Spinner } from "#/components/Spinner";
import {
	artistListOptions,
	useArtists,
	useMyArtists,
} from "#/lib/hooks/useArtists";
import { useUser } from "#/lib/hooks/useUser";
import { DEFAULT_MAP_CENTER } from "#/lib/mapUtils";

const DEFAULT_RADIUS = 50;

interface ArtistsSearch {
	lat?: number;
	lng?: number;
	radius?: number;
	genre?: string;
}

export const Route = createFileRoute("/music/artists/")({
	head: () => ({
		meta: [
			{ title: "Artists | 919Events" },
			{
				name: "description",
				content:
					"Discover local artists and musicians playing shows near you. Artists can create a profile and list their own concerts.",
			},
			{ property: "og:title", content: "Artists | 919Events" },
		],
		links: [{ rel: "canonical", href: "https://919events.com/music/artists" }],
	}),
	validateSearch: (search: Record<string, unknown>): ArtistsSearch => ({
		lat: search.lat ? Number(search.lat) : undefined,
		lng: search.lng ? Number(search.lng) : undefined,
		radius: search.radius ? Number(search.radius) : undefined,
		genre: (search.genre as string) || undefined,
	}),
	loaderDeps: ({ search }) => ({
		lat: search.lat,
		lng: search.lng,
		radius: search.radius,
		genre: search.genre,
	}),
	loader: async ({ context, deps }) => {
		if (!deps.lat || !deps.lng) return;
		await context.queryClient.prefetchQuery(
			artistListOptions({
				lat: deps.lat,
				lng: deps.lng,
				radius: deps.radius ?? DEFAULT_RADIUS,
				genre: deps.genre,
			}),
		);
	},
	component: ArtistsPage,
});

function ArtistsPage() {
	const search = Route.useSearch();
	const navigate = useNavigate();
	const { isSignedIn } = useAuth();
	const { data: user } = useUser();

	useEffect(() => {
		if (search.lat && search.lng) return;

		const saved = getSavedLocation();
		if (saved) {
			navigate({
				to: "/music/artists",
				search: (prev) => ({ ...prev, lat: saved.lat, lng: saved.lng }),
				replace: true,
			});
			return;
		}

		if (isSignedIn && user?.DefaultLatitude && user?.DefaultLongitude) {
			navigate({
				to: "/music/artists",
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

	const { data, isLoading } = useArtists(
		{ lat, lng, radius, genre: search.genre },
		true,
	);
	const artists = data?.artists ?? [];
	const { data: myArtists } = useMyArtists(isSignedIn);

	function update(updates: Partial<ArtistsSearch>) {
		navigate({
			to: "/music/artists",
			search: (prev) => ({ ...prev, ...updates }),
			replace: true,
		});
	}

	return (
		<div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-(--sea-ink)">Artists</h1>
					<p className="text-sm text-(--sea-ink-soft)">
						Musicians playing near you
					</p>
				</div>
				<LocationSearch compact />
			</div>

			<div className="flex flex-wrap items-center gap-3 rounded-lg border border-(--line) bg-(--surface-strong) p-4">
				<select
					value={search.genre ?? ""}
					onChange={(e) => update({ genre: e.target.value || undefined })}
					className="w-full rounded-md border border-(--line) px-3 py-2 text-sm sm:w-auto"
				>
					<option value="">All Genres</option>
					{MUSIC_GENRES.map((g) => (
						<option key={g} value={g}>
							{g}
						</option>
					))}
				</select>
				<select
					value={radius}
					onChange={(e) => update({ radius: Number(e.target.value) })}
					className="w-full rounded-md border border-(--line) px-3 py-2 text-sm sm:w-auto"
				>
					{[10, 25, 50, 100].map((r) => (
						<option key={r} value={r}>
							{r} miles
						</option>
					))}
				</select>
				<Link
					to="/music/artists/new"
					className="ml-auto rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-medium text-(--foam) hover:opacity-90"
				>
					Add your profile
				</Link>
			</div>

			{isSignedIn && myArtists && myArtists.length > 0 && (
				<div>
					<h2 className="mb-3 text-lg font-semibold text-(--sea-ink)">
						Your profiles
					</h2>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{myArtists.map((artist) => (
							<ArtistCard key={artist.ID} artist={artist} />
						))}
					</div>
					<h2 className="mt-8 mb-3 text-lg font-semibold text-(--sea-ink)">
						Playing nearby
					</h2>
				</div>
			)}

			{isLoading ? (
				<Spinner className="py-12" />
			) : artists.length === 0 ? (
				<div className="rounded-lg border border-(--line) bg-(--surface-strong) px-4 py-16 text-center">
					<p className="text-(--sea-ink)">No artists found nearby.</p>
					<p className="mt-1 text-sm text-(--sea-ink-soft)">
						Try widening the distance or clearing the genre — or{" "}
						<Link
							to="/music/artists/new"
							className="font-medium text-(--lagoon-deep) hover:underline"
						>
							add your artist profile
						</Link>
						.
					</p>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{artists.map((artist) => (
						<ArtistCard key={artist.ID} artist={artist} />
					))}
				</div>
			)}
		</div>
	);
}
