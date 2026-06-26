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
	}
}

// track sends a custom event to GA4. It is a no-op during SSR and when gtag
// hasn't loaded (e.g. blocked by an ad blocker), so callers never need to guard.
export function track(name: string, params?: AnalyticsParams): void {
	if (typeof window === "undefined" || typeof window.gtag !== "function") {
		return;
	}
	// Drop undefined values so GA4 doesn't record empty params.
	const clean = params
		? Object.fromEntries(
				Object.entries(params).filter(([, v]) => v !== undefined),
			)
		: undefined;
	window.gtag("event", name, clean);
}
