import { createFileRoute, redirect } from "@tanstack/react-router";

interface DrinksLegacySearch {
	lat?: number;
	lng?: number;
	radius?: number;
	type?: "brewery" | "bar";
	search?: string;
	fullscreen?: 1;
}

export const Route = createFileRoute("/drinks/")({
	validateSearch: (search: Record<string, unknown>): DrinksLegacySearch => ({
		lat: search.lat ? Number(search.lat) : undefined,
		lng: search.lng ? Number(search.lng) : undefined,
		radius:
			search.radius !== undefined && search.radius !== ""
				? Number(search.radius)
				: undefined,
		type: ["brewery", "bar"].includes(search.type as string)
			? (search.type as "brewery" | "bar")
			: undefined,
		search: (search.search as string) || undefined,
		fullscreen: search.fullscreen ? 1 : undefined,
	}),
	beforeLoad: ({ search }) => {
		throw redirect({
			to: "/places",
			search: {
				tab: "drinks" as const,
				lat: search.lat,
				lng: search.lng,
				radius: search.radius,
				type: search.type,
				search: search.search,
				fullscreen: search.fullscreen,
			},
			replace: true,
		});
	},
});
