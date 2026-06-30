// Lightweight wrapper over the Google Analytics 4 gtag that is loaded in
// __root.tsx. GA4 already auto-tracks pageviews; this adds custom feature-usage
// events on top so we can build funnels for things like the planner, featuring,
// saving, and search.
//
// Usage: track("planner_build", { authed: true, radius: 25 })
//
// Event names should be snake_case and stable — renaming one starts a fresh
// series in GA4. Keep the catalog of names below as the single source of truth.

type Primitive = string | number | boolean;
export type AnalyticsParams = Record<string, Primitive | undefined>;

declare global {
	interface Window {
		gtag?: (command: "event", name: string, params?: AnalyticsParams) => void;
		// Meta (Facebook/Instagram) Pixel. Loaded in __root.tsx when
		// VITE_META_PIXEL_ID is set; absent during dev/SSR and when blocked.
		fbq?: (
			command: "track" | "trackCustom",
			name: string,
			params?: AnalyticsParams,
		) => void;
	}
}

// track sends a custom event to GA4 and, for mapped events, to the Meta Pixel.
// It is a no-op during SSR and when neither tag has loaded (e.g. blocked by an
// ad blocker), so callers never need to guard. `name` is typed to EventName so
// a typo or an un-catalogued name fails the build.
export function track(name: EventName, params?: AnalyticsParams): void {
	if (typeof window === "undefined") {
		return;
	}
	// Drop undefined values so GA4 doesn't record empty params.
	const clean = params
		? Object.fromEntries(
				Object.entries(params).filter(([, v]) => v !== undefined),
			)
		: undefined;
	if (typeof window.gtag === "function") {
		window.gtag("event", name, clean);
	}
	const metaName = META_EVENTS[name];
	if (metaName && typeof window.fbq === "function") {
		window.fbq("track", metaName, clean);
	}
}

// pageView fires a Meta Pixel PageView. The Pixel only auto-fires once on first
// load, so this is called on every client route change (see __root.tsx). GA4
// enhanced measurement already tracks SPA history changes, so it's not repeated
// here.
export function pageView(): void {
	if (typeof window !== "undefined" && typeof window.fbq === "function") {
		window.fbq("track", "PageView");
	}
}

// Single source of truth for event names. snake_case, stable — renaming one
// starts a fresh series in GA4. Add new events here before calling track().
export const EVENTS = {
	// save
	saveEvent: "save_event",
	unsaveEvent: "unsave_event",
	saveSigninPrompt: "save_signin_prompt",
	// planner
	plannerBuild: "planner_build",
	plannerSaveDay: "planner_save_day",
	plannerAddToCalendar: "planner_add_to_calendar",
	plannerShareDay: "planner_share_day",
	plannerSignupCta: "planner_signup_cta",
	plannerEnableDigestCta: "planner_enable_digest_cta",
	// browse / discovery
	filterEvents: "filter_events",
	search: "search",
	viewEvent: "view_event",
	ticketUrlClick: "ticket_url_click",
	// feature funnel
	featureEventClick: "feature_event_click",
	featureEventSignupPrompt: "feature_event_signup_prompt",
	featureEventSuccess: "feature_event_success",
	featureEventLimitReached: "feature_event_limit_reached",
	featureEventSubscribePrompt: "feature_event_subscribe_prompt",
	featureEventSubscribeCtaClick: "feature_event_subscribe_cta_click",
	featureEventSignupCtaClick: "feature_event_signup_cta_click",
	// chat
	chatOpen: "chat_open",
	chatClose: "chat_close",
	chatMessageSent: "chat_message_sent",
	chatClearHistory: "chat_clear_history",
	chatStop: "chat_stop",
	chatSetLocation: "chat_set_location",
	chatEventLinkClick: "chat_event_link_click",
	chatLinkClick: "chat_link_click",
	// auth
	signIn: "sign_in",
	signUp: "sign_up",
	// submit funnel
	submitEventStart: "submit_event_start",
	submitEventSuccess: "submit_event_success",
	submitEventError: "submit_event_error",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

// Subset of our GA4 events that also map to a Meta standard event. We fire
// these to the Pixel alongside GA4 so Meta ad campaigns can build audiences
// (people who searched, viewed, saved, signed up) and later optimize toward
// that intent. Events not listed here stay GA4-only. Standard event names are
// fixed by Meta — see developers.facebook.com/docs/meta-pixel/reference.
//
// Declared after EVENTS: the computed keys read EVENTS at module-eval time, so
// this must follow EVENTS to avoid a temporal-dead-zone ReferenceError that
// would crash every SSR render (this module is imported by __root.tsx).
const META_EVENTS: Partial<Record<EventName, string>> = {
	[EVENTS.search]: "Search",
	[EVENTS.viewEvent]: "ViewContent",
	[EVENTS.saveEvent]: "Lead",
	[EVENTS.signUp]: "CompleteRegistration",
};
