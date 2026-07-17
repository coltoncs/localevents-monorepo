import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { EventTable } from "#/components/events/EventTable";
import { Spinner } from "#/components/Spinner";
import { eventListOptions, useEvents } from "#/lib/hooks/useEvents";
import { getLandingCity } from "#/lib/landingCities";

function todayString(): string {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

export const Route = createFileRoute("/events/in/$city")({
	head: ({ params }) => {
		const city = getLandingCity(params.city);
		if (!city) return {};
		const title = `Events in ${city.name}, ${city.region} | 919Events`;
		const description = `Find upcoming events in ${city.name} — concerts, festivals, food & drink, and things to do near you.`;
		return {
			meta: [
				{ title },
				{ name: "description", content: description },
				{ property: "og:title", content: title },
				{ property: "og:description", content: description },
			],
			links: [
				{
					rel: "canonical",
					href: `https://919events.com/events/in/${city.slug}`,
				},
			],
		};
	},
	loader: async ({ context, params }) => {
		const city = getLandingCity(params.city);
		if (!city) throw notFound();
		await context.queryClient.prefetchQuery(
			eventListOptions({
				lat: city.lat,
				lng: city.lng,
				radius: city.radius,
				date: todayString(),
			}),
		);
	},
	pendingComponent: () => <Spinner className="py-24" />,
	component: CityLandingPage,
});

function CityLandingPage() {
	const { city: slug } = Route.useParams();
	// The loader's notFound() guard means this is normally defined at render time.
	const city = getLandingCity(slug);

	// Hook must run unconditionally (rules of hooks); disable it if there's no
	// city so we never fire a bogus query.
	const { data, isLoading } = useEvents(
		city
			? {
					lat: city.lat,
					lng: city.lng,
					radius: city.radius,
					date: todayString(),
				}
			: { lat: 0, lng: 0 },
		!!city,
	);

	if (!city) return null;

	const events = data?.events ?? [];

	return (
		<div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
			<header className="space-y-2">
				<h1 className="text-3xl font-bold text-(--sea-ink)">
					Events in {city.name}
				</h1>
				<p className="max-w-2xl text-(--sea-ink-soft)">{city.blurb}</p>
			</header>

			<div className="flex flex-wrap gap-3">
				<Link
					to="/events"
					search={{
						lat: city.lat,
						lng: city.lng,
						radius: city.radius,
						view: "list",
					}}
					className="rounded-md bg-(--lagoon-deep) px-6 py-3 text-sm font-semibold text-(--foam) shadow-sm hover:opacity-90"
				>
					Browse all {city.name} events
				</Link>
				<Link
					to="/events"
					search={{ lat: city.lat, lng: city.lng, radius: city.radius }}
					className="rounded-md border border-(--line) bg-(--surface-strong) px-6 py-3 text-sm font-semibold text-(--sea-ink) shadow-sm hover:bg-(--surface)"
				>
					Open map
				</Link>
			</div>

			{isLoading ? (
				<Spinner className="py-12" />
			) : events.length > 0 ? (
				<EventTable events={events} />
			) : (
				<p className="py-12 text-center text-(--sea-ink-soft)">
					No upcoming events found in {city.name} right now — check back soon.
				</p>
			)}
		</div>
	);
}
