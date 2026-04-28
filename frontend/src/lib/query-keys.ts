import type { EventFilters, PlaceFilters } from "./types";

interface VenueFilters {
	lat: number;
	lng: number;
	radius?: number;
}

export const queryKeys = {
	places: {
		all: ["places"] as const,
		list: (filters: PlaceFilters) => ["places", "list", filters] as const,
		detail: (id: string) => ["places", "detail", id] as const,
	},
	events: {
		all: ["events"] as const,
		list: (filters: EventFilters) => ["events", "list", filters] as const,
		detail: (id: string) => ["events", "detail", id] as const,
		series: (seriesId: string) => ["events", "series", seriesId] as const,
	},
	venues: {
		all: ["venues"] as const,
		list: (filters: VenueFilters) => ["venues", "list", filters] as const,
		detail: (id: string) => ["venues", "detail", id] as const,
	},
	user: {
		me: ["user", "me"] as const,
		myEvents: ["user", "myEvents"] as const,
	},
	savedEvents: {
		all: ["savedEvents"] as const,
		list: ["savedEvents", "list"] as const,
		check: (eventId: string) => ["savedEvents", "check", eventId] as const,
	},
	saveCounts: {
		all: ["saveCounts"] as const,
		detail: (eventId: string) => ["saveCounts", eventId] as const,
	},
	placeCheckIns: {
		all: ["placeCheckIns"] as const,
		counts: (placeId: string) => ["placeCheckIns", "counts", placeId] as const,
		myStatus: (placeId: string) =>
			["placeCheckIns", "myStatus", placeId] as const,
		mine: ["placeCheckIns", "mine"] as const,
	},
	applications: {
		all: ["applications"] as const,
		pending: ["applications", "pending"] as const,
		mine: ["applications", "mine"] as const,
	},
	images: {
		all: ["images"] as const,
		list: ["images", "list"] as const,
	},
	notifications: {
		preferences: ["notifications", "preferences"] as const,
	},
	suggestions: {
		all: ["suggestions"] as const,
		pending: ["suggestions", "pending"] as const,
		mine: ["suggestions", "mine"] as const,
	},
	admin: {
		stats: ["admin", "stats"] as const,
	},
};
