import type { BeverageFilters, EventFilters, FoodFilters } from "./types";

interface VenueFilters {
	lat: number;
	lng: number;
	radius?: number;
}

export const queryKeys = {
	beverages: {
		all: ["beverages"] as const,
		list: (filters: BeverageFilters) => ["beverages", "list", filters] as const,
		detail: (id: string) => ["beverages", "detail", id] as const,
	},
	foods: {
		all: ["foods"] as const,
		list: (filters: FoodFilters) => ["foods", "list", filters] as const,
		detail: (id: string) => ["foods", "detail", id] as const,
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
	beverageCheckIns: {
		all: ["beverageCheckIns"] as const,
		counts: (beverageId: string) =>
			["beverageCheckIns", "counts", beverageId] as const,
		myStatus: (beverageId: string) =>
			["beverageCheckIns", "myStatus", beverageId] as const,
		mine: ["beverageCheckIns", "mine"] as const,
	},
	foodCheckIns: {
		all: ["foodCheckIns"] as const,
		counts: (foodId: string) => ["foodCheckIns", "counts", foodId] as const,
		myStatus: (foodId: string) => ["foodCheckIns", "myStatus", foodId] as const,
		mine: ["foodCheckIns", "mine"] as const,
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
