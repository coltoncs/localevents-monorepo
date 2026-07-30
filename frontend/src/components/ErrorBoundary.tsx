import { Component, type ReactNode } from "react";
import { track } from "#/lib/analytics";

interface Props {
	children: ReactNode;
	/** Short identifier for where the crash happened, reported to GA4. */
	name: string;
	/** Rendered instead of the subtree when it crashes. Defaults to nothing. */
	fallback?: ReactNode;
}

interface State {
	failed: boolean;
}

/**
 * Keeps one broken subtree from taking down the whole page.
 *
 * Without a boundary, any throw during render or in an effect propagates to the
 * React root and unmounts everything — the symptom being a page with no header,
 * no auth controls, and no data, which is indistinguishable from "the site is
 * down". That was the failure mode in storage-restricted in-app browsers
 * (Facebook/Instagram webviews), where a `localStorage` read threw during
 * hydration. Storage access is now guarded (see lib/storage.ts); this boundary
 * is the backstop for whatever the next environment-specific surprise is.
 *
 * Crashes report to GA4 as `client_error` with the boundary name, so an issue
 * that only reproduces on someone else's device still shows up in analytics.
 */
export class ErrorBoundary extends Component<Props, State> {
	state: State = { failed: false };

	static getDerivedStateFromError(): State {
		return { failed: true };
	}

	componentDidCatch(error: unknown) {
		const message =
			error instanceof Error
				? `${error.name}: ${error.message}`
				: String(error);
		// Truncated: GA4 caps text param values at 100 chars.
		track("client_error", {
			boundary: this.props.name,
			message: message.slice(0, 100),
		});
		console.error(`[${this.props.name}]`, error);
	}

	render() {
		if (this.state.failed) return this.props.fallback ?? null;
		return this.props.children;
	}
}
