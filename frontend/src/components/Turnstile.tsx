import { useEffect, useRef } from "react";

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT_SRC =
	"https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// Whether Turnstile is configured. When false the widget renders nothing and
// callers should treat verification as skipped (matches the server, which also
// skips verification when no secret is set).
export const turnstileEnabled = Boolean(SITE_KEY);

// Without the key Vite constant-folds `turnstileEnabled` to false and tree-shakes
// this whole widget out of the bundle, so a build that forgot the variable looks
// identical to one that never wanted a captcha — while the server still rejects
// every tokenless submission. Say so out loud in the browser.
if (typeof window !== "undefined" && !SITE_KEY) {
	console.warn(
		"[turnstile] VITE_TURNSTILE_SITE_KEY is not set in this build; no captcha token will be sent. " +
			"If the API reports turnstile_enforced=true (GET /api/health), every /api/subscribe request will fail with 403.",
	);
}

interface TurnstileApi {
	render: (
		el: HTMLElement,
		opts: {
			sitekey: string;
			callback: (token: string) => void;
			"expired-callback"?: () => void;
			"error-callback"?: () => void;
			theme?: "light" | "dark" | "auto";
			size?: "normal" | "flexible" | "compact";
		},
	) => string;
	remove: (id: string) => void;
	reset: (id?: string) => void;
}

declare global {
	interface Window {
		turnstile?: TurnstileApi;
	}
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
	if (typeof window === "undefined") return Promise.reject();
	if (window.turnstile) return Promise.resolve();
	if (scriptPromise) return scriptPromise;
	scriptPromise = new Promise((resolve, reject) => {
		const s = document.createElement("script");
		s.src = SCRIPT_SRC;
		s.async = true;
		s.defer = true;
		s.onload = () => resolve();
		s.onerror = () => reject(new Error("failed to load turnstile"));
		document.head.appendChild(s);
	});
	return scriptPromise;
}

interface TurnstileProps {
	onVerify: (token: string) => void;
	onExpire?: () => void;
	// Increment to discard the current token and re-run the challenge. Turnstile
	// tokens are single-use and are spent by the first siteverify call, so a form
	// that failed for any reason MUST reset before the visitor retries —
	// otherwise the second submit fails with `timeout-or-duplicate` regardless of
	// what the visitor changed, and they can never get through.
	resetSignal?: number;
}

export function Turnstile({ onVerify, onExpire, resetSignal }: TurnstileProps) {
	const ref = useRef<HTMLDivElement>(null);
	const widgetId = useRef<string | null>(null);
	// Keep the latest callbacks in a ref so the widget renders exactly once.
	const cbRef = useRef({ onVerify, onExpire });
	cbRef.current = { onVerify, onExpire };

	useEffect(() => {
		if (!SITE_KEY) return;
		let cancelled = false;

		loadScript()
			.then(() => {
				if (cancelled || !ref.current || !window.turnstile) return;
				widgetId.current = window.turnstile.render(ref.current, {
					sitekey: SITE_KEY,
					size: "flexible",
					callback: (token: string) => cbRef.current.onVerify(token),
					"expired-callback": () => cbRef.current.onExpire?.(),
					"error-callback": () => cbRef.current.onExpire?.(),
				});
			})
			.catch(() => {});

		return () => {
			cancelled = true;
			if (widgetId.current && window.turnstile) {
				try {
					window.turnstile.remove(widgetId.current);
				} catch {
					// widget already gone
				}
				widgetId.current = null;
			}
		};
	}, []);

	// Skip the initial render — only an actual bump should reset the widget.
	const lastReset = useRef(resetSignal);
	useEffect(() => {
		if (resetSignal === lastReset.current) return;
		lastReset.current = resetSignal;
		if (!widgetId.current || !window.turnstile) return;
		try {
			window.turnstile.reset(widgetId.current);
		} catch {
			// widget already gone
		}
		cbRef.current.onExpire?.();
	}, [resetSignal]);

	if (!SITE_KEY) return null;
	return <div ref={ref} className="mt-1" />;
}
