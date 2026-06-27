import { AIChatAgent } from "@cloudflare/ai-chat";
import {
	convertToModelMessages,
	type StreamTextOnFinishCallback,
	stepCountIs,
	streamText,
	type ToolSet,
	tool,
} from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";

// Tool-calling capable Workers AI model (multi-turn tool use).
const MODEL = "@cf/zai-org/glm-4.7-flash";

// Cap on how many events we hand back to the model per search, to keep the
// context (and token cost) bounded.
const MAX_EVENTS = 12;

/**
 * Compact projection of an event for the model. The full Event object from the
 * API is large; the model only needs enough to recommend and link.
 */
interface CompactEvent {
	id: string;
	title: string;
	venue?: string;
	city?: string;
	start: string;
	end?: string;
	categories?: string[];
	price?: string;
	isFree?: boolean;
	ticketUrl?: string;
	url: string;
}

/** The subset of the API's Event JSON that the agent reads. */
interface RawEvent {
	ID: string;
	Title: string;
	VenueName?: string | null;
	City?: string | null;
	StartTime: string;
	EndTime?: string | null;
	Categories?: string[] | null;
	PriceMin?: number | null;
	PriceMax?: number | null;
	IsFree?: boolean | null;
	TicketUrl?: string | null;
}

function formatPrice(
	min?: number,
	max?: number,
	isFree?: boolean,
): string | undefined {
	if (isFree) return "Free";
	if (min == null && max == null) return undefined;
	if (min != null && max != null && min !== max) return `$${min}–$${max}`;
	return `$${min ?? max}`;
}

// Canonical categories (mirrors the app's filter list). The API stores these
// Title-Cased and matches exactly, so we never send `category` to the API;
// instead we fetch broadly and filter here, case-insensitively.
const CATEGORIES = [
	"Music",
	"Sports",
	"Arts",
	"Kids",
	"Food & Drink",
	"Tech",
	"Entertainment",
	"Community",
	"Outdoors",
	"Nightlife",
] as const;

// Common phrasings the model/users use → canonical category term (lowercased).
const CATEGORY_SYNONYMS: Record<string, string> = {
	concert: "music",
	concerts: "music",
	"live music": "music",
	gig: "music",
	gigs: "music",
	show: "music",
	shows: "music",
	dj: "music",
	band: "music",
	bands: "music",
	comedy: "entertainment",
	theater: "arts",
	theatre: "arts",
	family: "kids",
	party: "nightlife",
	club: "nightlife",
};

/** Whether an event's category tags satisfy a requested category term. */
function matchesCategory(
	eventCategories: string[] | undefined,
	requested: string,
): boolean {
	if (!eventCategories?.length) return false;
	const raw = requested.toLowerCase().trim();
	const want = CATEGORY_SYNONYMS[raw] ?? raw;
	return eventCategories.some((c) => {
		const cat = c.toLowerCase();
		return cat === want || cat.includes(want) || want.includes(cat);
	});
}

export class EventChatAgent extends AIChatAgent<Cloudflare.Env> {
	async onStart(props?: Record<string, unknown>): Promise<void> {
		await super.onStart?.(props);
		// PartyServer resolves the instance name from `ctx.id.name`, with a
		// `__ps_name` storage record as the on-wake fallback. The local vite-dev
		// DO emulation doesn't populate `ctx.id.name` for idFromName-addressed
		// stubs; the `x-partykit-room` header (set in server.ts) only restores the
		// name in memory during the WebSocket upgrade, so once the DO hibernates
		// and a chat frame re-instantiates it, the name is lost and PartyServer
		// throws. onStart runs on every wake, so persist the name here to seed the
		// fallback. No-op in production, where `ctx.id.name` is already set.
		if (this.ctx.id.name === undefined) {
			try {
				await this.ctx.storage.put("__ps_name", this.name);
			} catch {
				// name not resolvable yet (no header/fallback) — nothing to persist
			}
		}
	}

	async onChatMessage(
		onFinish: StreamTextOnFinishCallback<ToolSet>,
		options?: { abortSignal?: AbortSignal; body?: Record<string, unknown> },
	): Promise<Response | undefined> {
		const workersai = createWorkersAI({ binding: this.env.AI });

		// The client passes the user's current location through the chat body so
		// the agent can search without asking. Falls back to the geocode tool.
		const ctx = (options?.body ?? {}) as {
			lat?: number;
			lng?: number;
			locationLabel?: string;
		};

		const today = new Date().toISOString().slice(0, 10);
		const knownLocation =
			typeof ctx.lat === "number" && typeof ctx.lng === "number"
				? `The user's current location is ${ctx.locationLabel ?? "their area"} (lat ${ctx.lat}, lng ${ctx.lng}). Use these coordinates for "near me" / unspecified-location searches.`
				: `The user's location is unknown. If they mention a place, call geocode_location first to get coordinates; otherwise ask where they are.`;

		const system = [
			"You are the LocalEvents assistant. You help people discover local events (concerts, shows, festivals, things to do) using ONLY the search_events tool — never invent events.",
			`Today's date is ${today}. Only pass date/endDate when the user explicitly mentions a timeframe — interpret relative dates ("this weekend", "tonight", "next Friday") into concrete YYYY-MM-DD ranges. If the user mentions NO timeframe, omit both date and endDate so the search covers all upcoming events. Never search dates in the past — only today or later.`,
			knownLocation,
			`For the category filter use exactly one of: ${CATEGORIES.join(", ")}. Map concerts/live music/DJs to "Music". If the user's interest isn't a category, omit category and use the search term instead.`,
			"The search_events tool already broadens automatically (it widens a too-narrow category and shows all nearby events instead), so ONE search is almost always enough. Do not call it repeatedly — if the first call returns events, present them. If a result includes a `note`, mention that you broadened the search.",
			"To find a specific event, artist, or venue by name, use the `search` parameter — it matches across ALL upcoming events regardless of date. The result's `total` is the full count of matching events; when it exceeds the few you list, you can mention there are more and offer to narrow by date or category.",
			"When recommending, be concise: a short intro line, then a handful of picks. For each pick give the title, venue, date/time (human-friendly), and price if known.",
			"Always link each event with a relative markdown link whose visible text is the event's EXACT title from the search results: [Exact Title](/events/{id}). Take the id from the SAME search-result row as that title — never reuse an id from a different event or an earlier search, and never fabricate ids.",
		].join("\n\n");

		const result = streamText({
			model: workersai(MODEL),
			system,
			messages: await convertToModelMessages(this.messages),
			stopWhen: stepCountIs(5),
			abortSignal: options?.abortSignal,
			tools: this.buildTools(ctx),
			// onFinish is typed against the broad ToolSet here but streamText narrows
			// it to our specific tool map; the cast bridges that variance.
			onFinish: onFinish as never,
		});

		return result.toUIMessageStreamResponse();
	}

	private buildTools(ctx: { lat?: number; lng?: number }) {
		return {
			search_events: tool({
				description:
					"Search local events near a location within a date range. Returns upcoming events sorted by distance and time.",
				inputSchema: z.object({
					lat: z
						.number()
						.optional()
						.describe("Latitude. Omit to use the user's current location."),
					lng: z
						.number()
						.optional()
						.describe("Longitude. Omit to use the user's current location."),
					radius: z
						.number()
						.optional()
						.describe("Search radius in miles. Default 10."),
					date: z
						.string()
						.optional()
						.describe(
							"Start date (inclusive), YYYY-MM-DD. ONLY set when the user names a day/timeframe. Omit it (and endDate) to search ALL upcoming events — do not default to today.",
						),
					endDate: z
						.string()
						.optional()
						.describe(
							"End date (inclusive), YYYY-MM-DD. Set with `date` for a multi-day range. Omit for a single day, or omit both for all upcoming events.",
						),
					category: z
						.string()
						.optional()
						.describe(
							`Optional category filter. Valid: ${CATEGORIES.join(", ")}. Use "Music" for concerts/live music/DJs. Matching is case-insensitive.`,
						),
					search: z
						.string()
						.optional()
						.describe("Free-text query matched against title and venue name."),
				}),
				execute: async (args) => {
					const lat = args.lat ?? ctx.lat;
					const lng = args.lng ?? ctx.lng;
					if (typeof lat !== "number" || typeof lng !== "number") {
						return {
							error:
								"No location available. Ask the user where they are, or call geocode_location first.",
						};
					}
					return this.searchEvents({ ...args, lat, lng });
				},
			}),

			geocode_location: tool({
				description:
					"Convert a place name (city, neighborhood, address) into latitude/longitude coordinates.",
				inputSchema: z.object({
					query: z
						.string()
						.describe(
							'Place to geocode, e.g. "Durham, NC" or "downtown Raleigh".',
						),
				}),
				execute: async ({ query }) => this.geocode(query),
			}),
		};
	}

	private async searchEvents(args: {
		lat: number;
		lng: number;
		radius?: number;
		date?: string;
		endDate?: string;
		category?: string;
		search?: string;
	}): Promise<
		{ events: CompactEvent[]; total: number; note?: string } | { error: string }
	> {
		const base = this.env.VITE_API_URL ?? "";
		const today = new Date().toISOString().slice(0, 10);

		// Resolve the date window. Only constrain by date when the caller actually
		// specified one — when no timeframe is given we omit `date` entirely so the
		// API falls back to its "all upcoming events" default (today → +1yr).
		// Sending `date` with no `end_date` would otherwise pin results to a single
		// day. Past dates are clamped to today (past events are deleted and 404).
		let date: string | undefined;
		let endDate: string | undefined;
		if (args.date) {
			date = args.date >= today ? args.date : today;
			if (args.endDate && args.endDate >= date) endDate = args.endDate;
		} else if (args.endDate && args.endDate >= today) {
			// end without start → search from today through that end date.
			date = today;
			endDate = args.endDate;
		}
		// Searching across the full window (no date) needs a wider page than a
		// single day; category filtering also fetches wide to leave room.
		const wantCategory = args.category?.trim();
		const wide = wantCategory || !date;
		const params = new URLSearchParams({
			lat: String(args.lat),
			lng: String(args.lng),
			radius: String(args.radius ?? 10),
			limit: String(wide ? 60 : MAX_EVENTS),
		});
		if (date) params.set("date", date);
		if (endDate) params.set("end_date", endDate);
		if (args.search) params.set("search", args.search);

		let res: Response;
		try {
			res = await fetch(`${base}/api/events?${params.toString()}`, {
				headers: { Accept: "application/json" },
			});
		} catch (err) {
			return { error: `Failed to reach the events API: ${String(err)}` };
		}
		if (!res.ok) {
			return { error: `Events API returned ${res.status}.` };
		}

		const data = (await res.json()) as { events?: RawEvent[]; total?: number };
		const all = (data.events ?? []).map(
			(e): CompactEvent => ({
				id: e.ID,
				title: e.Title,
				venue: e.VenueName ?? undefined,
				city: e.City ?? undefined,
				start: e.StartTime,
				end: e.EndTime ?? undefined,
				categories: e.Categories ?? undefined,
				price: formatPrice(
					e.PriceMin ?? undefined,
					e.PriceMax ?? undefined,
					e.IsFree ?? undefined,
				),
				isFree: e.IsFree ?? undefined,
				ticketUrl: e.TicketUrl ?? undefined,
				url: `/events/${e.ID}`,
			}),
		);

		if (wantCategory) {
			const filtered = all.filter((e) =>
				matchesCategory(e.categories, wantCategory),
			);
			// Don't return empty just because the category didn't match — fall back
			// to all nearby events so the model can present something in one call.
			if (filtered.length > 0) {
				return {
					events: filtered.slice(0, MAX_EVENTS),
					total: filtered.length,
				};
			}
			return {
				events: all.slice(0, MAX_EVENTS),
				total: all.length,
				note: `No events tagged "${wantCategory}" were found nearby; showing all nearby events instead.`,
			};
		}

		return {
			events: all.slice(0, MAX_EVENTS),
			total: data.total ?? all.length,
		};
	}

	private async geocode(
		query: string,
	): Promise<{ lat: number; lng: number; label: string } | { error: string }> {
		const token = this.env.VITE_MAPBOX_TOKEN;
		if (!token) {
			return {
				error: "Geocoding is unavailable (no Mapbox token configured).",
			};
		}
		const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
			query,
		)}.json?access_token=${token}&limit=1`;

		let res: Response;
		try {
			res = await fetch(url);
		} catch (err) {
			return { error: `Geocoding request failed: ${String(err)}` };
		}
		if (!res.ok) return { error: `Geocoding returned ${res.status}.` };

		const data = (await res.json()) as {
			features?: Array<{ center: [number, number]; place_name: string }>;
		};
		const feature = data.features?.[0];
		if (!feature) return { error: `Couldn't find a location for "${query}".` };
		const [lng, lat] = feature.center;
		return { lat, lng, label: feature.place_name };
	}
}
