import { useAuth } from "@clerk/clerk-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
import {
	LocationPicker,
	type LocationValue,
} from "#/components/maps/LocationPicker";
import { Turnstile, turnstileEnabled } from "#/components/Turnstile";
import { EVENTS, track } from "#/lib/analytics";
import { ApiError } from "#/lib/api";
import { useCoverageCities } from "#/lib/hooks/useCoverage";
import { useSubscribeToDigest } from "#/lib/hooks/useDigestSubscribe";
import { useNotificationPreferences } from "#/lib/hooks/useNotifications";
import { storageGet, storageSet } from "#/lib/storage";

const STORAGE_KEY = "email-notif-banner-dismissed";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// The server tags every rejection with a stable `code` alongside the status.
// Pull it out for analytics so a failure is attributable to a specific branch
// of the handler rather than a bare status code.
function errorReason(error: unknown): string {
	if (!(error instanceof ApiError)) return "network";
	try {
		const code = JSON.parse(error.message)?.code;
		if (typeof code === "string") return code;
	} catch {
		// older deploy, or a non-JSON body (proxy/gateway error page)
	}
	return String(error.status);
}

// Failure copy that tells the visitor what to actually do. Everything used to
// collapse into "Something went wrong", which is unactionable and — for the
// recoverable captcha and rate-limit cases — actively misleading.
function errorMessage(error: unknown): string {
	const status = error instanceof ApiError ? error.status : 0;
	switch (status) {
		case 422:
			return "We don't cover that area yet — pick a location closer to a city we serve.";
		case 403:
			return "That verification expired. We've reset the check below — please complete it and try again.";
		case 429:
			return "Too many attempts from your network. Please try again in an hour.";
		case 400:
			return "Please double-check your email address and location.";
		default:
			return "Something went wrong. Please try again in a moment.";
	}
}

export function EmailNotifBanner() {
	const { isSignedIn, isLoaded } = useAuth();
	if (!isLoaded) return null;
	return isSignedIn ? <SignedInBanner /> : <AnonymousBanner />;
}

// Shared thin colored bar with a dismiss control. Returns null (rendering
// nothing) when dismissed or on the onboarding page.
function useBannerVisibility() {
	const [dismissed, setDismissed] = useState(true);
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	useEffect(() => {
		setDismissed(storageGet(STORAGE_KEY) === "1");
	}, []);

	function dismiss() {
		storageSet(STORAGE_KEY, "1");
		setDismissed(true);
	}

	const hidden = dismissed || pathname === "/welcome";
	return { hidden, dismiss };
}

function DismissButton({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="shrink-0 cursor-pointer rounded-md p-1 text-(--sea-ink-soft) hover:text-(--sea-ink) hover:bg-(--surface)"
			aria-label="Dismiss"
		>
			<svg
				className="h-4 w-4"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				strokeWidth={2}
				aria-hidden="true"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>
	);
}

// Signed-in users who haven't enabled the email digest: link them to settings.
function SignedInBanner() {
	const { data: prefs, isLoading } = useNotificationPreferences();
	const { hidden, dismiss } = useBannerVisibility();

	if (hidden || isLoading || !prefs || prefs.email_enabled) {
		return null;
	}

	return (
		<div className="border-b border-(--line) bg-[rgba(79,184,178,0.08)]">
			<div className="page-wrap flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
				<p className="text-sm text-(--sea-ink)">
					Get a weekly digest of events near you every Friday.{" "}
					<Link
						to="/settings"
						className="font-semibold text-(--lagoon-deep) hover:text-(--lagoon) underline"
					>
						Turn on email notifications
					</Link>
				</p>
				<DismissButton onClick={dismiss} />
			</div>
		</div>
	);
}

// Anonymous visitors: inline email + location signup (double opt-in). Collapsed
// to a thin bar until the visitor opts in, then expands into the form.
function AnonymousBanner() {
	const { hidden, dismiss } = useBannerVisibility();
	const [expanded, setExpanded] = useState(false);
	const [email, setEmail] = useState("");
	const [location, setLocation] = useState<LocationValue | null>(null);
	const [token, setToken] = useState<string | null>(null);
	// Bumped after every failed submit to force a fresh Turnstile token.
	const [captchaNonce, setCaptchaNonce] = useState(0);
	const emailId = useId();
	const subscribe = useSubscribeToDigest();
	const { data: coverage } = useCoverageCities();

	if (hidden) return null;

	const coverageConstraint = coverage
		? { cities: coverage.cities, radiusMiles: coverage.radius_miles }
		: null;

	const emailValid = EMAIL_RE.test(email.trim());
	const canSubmit =
		emailValid && location != null && (!turnstileEnabled || token != null);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!canSubmit || location == null) return;
		track(EVENTS.digestSubscribeSubmit, { captcha: turnstileEnabled });
		subscribe.mutate(
			{
				email: email.trim(),
				latitude: location.lat,
				longitude: location.lng,
				turnstile_token: token ?? undefined,
			},
			{
				onSuccess: () => track(EVENTS.digestSubscribeSuccess),
				onError: (error) => {
					track(EVENTS.digestSubscribeError, {
						reason: errorReason(error),
						status: error instanceof ApiError ? error.status : 0,
					});
					// The token was spent by the failed attempt. Without this the
					// retry always fails as a duplicate, whatever the visitor fixes.
					setToken(null);
					setCaptchaNonce((n) => n + 1);
				},
			},
		);
	}

	return (
		<div className="border-b border-(--line) bg-[rgba(79,184,178,0.08)]">
			<div className="page-wrap px-4 py-2.5 sm:px-6 lg:px-8">
				{subscribe.isSuccess ? (
					<div className="flex items-center justify-between gap-3">
						<p className="text-sm text-(--sea-ink)">
							Almost there — check your inbox and confirm your subscription to
							start getting the weekly digest.
						</p>
						<DismissButton onClick={dismiss} />
					</div>
				) : !expanded ? (
					<div className="flex items-center justify-between gap-3">
						<p className="text-sm text-(--sea-ink)">
							Get a weekly digest of events near you every Friday — no account
							needed.{" "}
							<button
								type="button"
								onClick={() => {
									track(EVENTS.digestSubscribeStart);
									setExpanded(true);
								}}
								className="font-semibold text-(--lagoon-deep) hover:text-(--lagoon) underline"
							>
								Sign up with your email
							</button>
						</p>
						<DismissButton onClick={dismiss} />
					</div>
				) : (
					<form onSubmit={handleSubmit} className="flex flex-col gap-2">
						<div className="flex items-start justify-between gap-3">
							<p className="text-sm font-medium text-(--sea-ink)">
								Weekly digest of events near you
							</p>
							<DismissButton onClick={dismiss} />
						</div>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-end">
							<div className="sm:w-64">
								<label
									htmlFor={emailId}
									className="block text-sm font-medium text-(--sea-ink-soft)"
								>
									Email
								</label>
								<input
									id={emailId}
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="you@example.com"
									className="mt-1 block w-full rounded-md border border-(--line) bg-(--surface-strong) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon) focus:outline-none"
								/>
							</div>
							<div className="sm:flex-1">
								<LocationPicker
									label="Location"
									value={location}
									onChange={setLocation}
									coverage={coverageConstraint}
									compact
								/>
							</div>
							<button
								type="submit"
								disabled={!canSubmit || subscribe.isPending}
								className="h-[38px] shrink-0 cursor-pointer rounded-md bg-(--lagoon-deep) px-4 text-sm font-semibold text-white hover:bg-(--lagoon) disabled:cursor-not-allowed disabled:opacity-50"
							>
								{subscribe.isPending ? "Signing up…" : "Subscribe"}
							</button>
						</div>
						{turnstileEnabled && (
							<Turnstile
								onVerify={setToken}
								onExpire={() => setToken(null)}
								resetSignal={captchaNonce}
							/>
						)}
						{subscribe.isError && (
							<p className="text-sm text-red-600">
								{errorMessage(subscribe.error)}
							</p>
						)}
					</form>
				)}
			</div>
		</div>
	);
}
