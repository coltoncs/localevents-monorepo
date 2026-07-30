// Safe localStorage access.
//
// Touching `window.localStorage` is NOT guaranteed to succeed even in a modern
// browser. In-app browsers (the Facebook / Instagram webview a referral link
// opens into), Safari Private Browsing, and any context where the user has
// blocked site data throw on the *property access itself*:
//
//   SecurityError: The operation is insecure.
//   DOMException: Access is denied for this document.
//
// An unguarded read inside a component render or effect therefore throws during
// hydration, and because React re-throws to the nearest boundary, an unhandled
// throw unmounts the entire tree — the page renders as blank/inert with no
// Clerk controls and no data. Always go through these helpers.

export function storageGet(key: string): string | null {
	if (typeof window === "undefined") return null;
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
}

export function storageSet(key: string, value: string): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(key, value);
	} catch {
		// Storage blocked (in-app browser / private mode) or quota exceeded.
		// Persistence is always a nice-to-have here, never load-bearing.
	}
}

export function storageRemove(key: string): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.removeItem(key);
	} catch {
		// see storageSet
	}
}

/** True when localStorage is readable/writable. Useful for diagnostics. */
export function storageAvailable(): boolean {
	if (typeof window === "undefined") return false;
	try {
		const probe = "__storage_probe__";
		window.localStorage.setItem(probe, "1");
		window.localStorage.removeItem(probe);
		return true;
	} catch {
		return false;
	}
}
