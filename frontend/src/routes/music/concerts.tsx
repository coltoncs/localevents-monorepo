import { useAuth } from "@clerk/clerk-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { EventCard } from "#/components/events/EventCard";
import {
	getSavedLocation,
	LocationSearch,
} from "#/components/maps/LocationSearch";
import { ConcertFilters } from "#/components/music/ConcertFilters";
import { Pagination } from "#/components/Pagination";
import { Spinner } from "#/components/Spinner";
import { eventListOptions, useEvents } from "#/lib/hooks/useEvents";
import { useUser } from "#/lib/hooks/useUser";
import { DEFAULT_MAP_CENTER } from "#/lib/mapUtils";

// The Concerts page is the events list pinned to the Music category, with a
// genre filter and date quick-picks tuned for fast concert discovery.
const DEFAULT_RADIUS = 25;
const PAGE_SIZE = 20;

interface ConcertsSearch {
	lat?: number;
	lng?: number;
	radius?: number;
	date?: string;
	endDate?: string;
	genre?: string;
	search?: string;
	page?: number;
}

export const Route = createFileRoute("/music/concerts")({
	head: () => ({
		meta: [
			{ title: "Concerts | 919Events" },
			{
				name: "description",
				content:
					"Find upcoming concerts and live music near you. Filter by genre, date, and distance.",
			},
			{ property: "og:title", content: "Concerts | 919Events" },
			{
				property: "og:description",
				content:
					"Find upcoming concerts and live music near you. Filter by genre, date, and distance.",
			},
		],
		links: [{ rel: "canonical", href: "https://919events.com/music/concerts" }],
	}),
	validateSearch: (search: Record<string, unknown>): ConcertsSearch => ({
		lat: search.lat ? Number(search.lat) : undefined,
		lng: search.lng ? Number(search.lng) : undefined,
		radius: search.radius ? Number(search.radius) : undefined,
		date: (search.date as string) || undefined,
		endDate: (search.endDate as string) || undefined,
		genre: (search.genre as string) || undefined,
		search: (search.search as string) || undefined,
		page: search.page ? Number(search.page) : undefined,
	}),
	loaderDeps: ({ search }) => ({
		lat: search.lat,
		lng: search.lng,
		radius: search.radius,
		date: search.date,
		endDate: search.endDate,
		genre: search.genre,
		search: search.search,
		page: search.page,
	}),
	loader: async ({ context, deps }) => {
		if (!deps.lat || !deps.lng) return;
		await context.queryClient.prefetchQuery(
			eventListOptions({
				lat: deps.lat,
				lng: deps.lng,
				radius: deps.radius ?? DEFAULT_RADIUS,
				date: deps.date,
				endDate: deps.endDate,
				category: "Music",
				genre: deps.genre,
				search: deps.search,
				page: deps.page,
			}),
		);
	},
	component: ConcertsPage,
});

function ConcertsPage() {
	const search = Route.useSearch();
	const navigate = useNavigate();
	const { isSignedIn } = useAuth();
	const { data: user } = useUser();

	// Resolve a location the same way the events page does: saved location, then
	// the signed-in user's default, then the regional fallback.
	useEffect(() => {
		if (search.lat && search.lng) return;

		const saved = getSavedLocation();
		if (saved) {
			navigate({
				to: "/music/concerts",
				search: (prev) => ({ ...prev, lat: saved.lat, lng: saved.lng }),
				replace: true,
			});
			return;
		}

		if (isSignedIn && user?.DefaultLatitude && user?.DefaultLongitude) {
			navigate({
				to: "/music/concerts",
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
	const page = search.page ?? 1;

	const { data, isLoading } = useEvents(
		{
			lat,
			lng,
			radius,
			date: search.date,
			endDate: search.endDate,
			category: "Music",
			genre: search.genre,
			search: search.search,
			page,
		},
		true,
	);

	const events = data?.events ?? [];
	const total = data?.total ?? 0;
	const totalPages = Math.ceil(total / PAGE_SIZE);

	function goToPage(p: number) {
		navigate({
			to: "/music/concerts",
			search: (prev) => ({ ...prev, page: p > 1 ? p : undefined }),
			replace: true,
			resetScroll: false,
		});
	}

	return (
		<div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-(--sea-ink)">Concerts</h1>
					<p className="text-sm text-(--sea-ink-soft)">
						Upcoming live music near you
					</p>
				</div>
				<LocationSearch compact />
			</div>

			<ConcertFilters
				genre={search.genre}
				date={search.date}
				endDate={search.endDate}
				radius={search.radius}
				search={search.search}
				lat={lat}
				lng={lng}
			/>

			{isLoading ? (
				<Spinner className="py-12" />
			) : events.length === 0 ? (
				<div className="rounded-lg border border-(--line) bg-(--surface-strong) px-4 py-16 text-center">
					<p className="text-(--sea-ink)">No concerts found.</p>
					<p className="mt-1 text-sm text-(--sea-ink-soft)">
						Try widening the distance, clearing the genre, or picking different
						dates.
					</p>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{events.map((event) => (
						<EventCard key={event.ID} event={event} />
					))}
				</div>
			)}

			{totalPages > 1 && (
				<Pagination
					page={page}
					totalPages={totalPages}
					onPageChange={goToPage}
				/>
			)}
		</div>
	);
}
