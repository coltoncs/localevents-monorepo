import { useAuth } from "@clerk/clerk-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
	type DigestFormat,
	DigestOptInFields,
	type EmailStyle,
} from "#/components/DigestOptInFields";
import {
	LocationPicker,
	type LocationValue,
} from "#/components/LocationPicker";
import { useUpdateNotificationPreferences } from "#/lib/hooks/useNotifications";
import { useUpdateSettings, useUser } from "#/lib/hooks/useUser";

export const Route = createFileRoute("/welcome")({
	component: WelcomePage,
});

type Step = "location" | "digest";

function WelcomePage() {
	const { isSignedIn, isLoaded } = useAuth();
	const navigate = useNavigate();
	const { data: user, isLoading: userLoading } = useUser();
	const updateSettings = useUpdateSettings();
	const updatePrefs = useUpdateNotificationPreferences();

	const [step, setStep] = useState<Step>("location");
	const [location, setLocation] = useState<LocationValue | null>(null);
	const [emailEnabled, setEmailEnabled] = useState(true);
	const [digestFormat, setDigestFormat] = useState<DigestFormat>("daily");
	const [emailStyle, setEmailStyle] = useState<EmailStyle>("detailed");
	const [preferredCategories, setPreferredCategories] = useState<string[]>([]);
	const [error, setError] = useState("");

	// Snapshot whether the user already had a location at first load.
	// We can't bypass on the live `user` object — Step 1 writes a location
	// and would otherwise immediately trigger the bypass before Step 2.
	const initialHadLocation = useRef<boolean | null>(null);
	if (initialHadLocation.current === null && user) {
		initialHadLocation.current = !!(
			user.DefaultLatitude && user.DefaultLongitude
		);
	}

	useEffect(() => {
		if (isLoaded && !isSignedIn) {
			navigate({ to: "/" });
		}
	}, [isLoaded, isSignedIn, navigate]);

	// Returning users who already finished onboarding bypass the flow.
	useEffect(() => {
		if (initialHadLocation.current === true) {
			navigate({ to: "/" });
		}
	}, [navigate]);

	if (!isLoaded || userLoading) {
		return (
			<div className="py-12 text-center text-(--sea-ink-soft)">Loading...</div>
		);
	}
	if (!isSignedIn) return null;

	async function handleLocationNext() {
		setError("");
		if (!location) {
			setError("Please pick a location to continue.");
			return;
		}
		try {
			await updateSettings.mutateAsync({
				default_latitude: location.lat,
				default_longitude: location.lng,
			});
			setStep("digest");
		} catch {
			setError("Could not save your location. Please try again.");
		}
	}

	async function handleDigestSubmit() {
		setError("");
		if (!emailEnabled) {
			navigate({ to: "/" });
			return;
		}
		if (!user?.Email) {
			setError(
				"Your account does not have an email address. Add one in your Clerk profile, then enable the digest from Settings.",
			);
			return;
		}
		try {
			await updatePrefs.mutateAsync({
				email_enabled: true,
				sms_enabled: false,
				preferred_categories: preferredCategories,
				digest_format: digestFormat,
				email_style: emailStyle,
			});
			navigate({ to: "/" });
		} catch {
			setError("Could not save your preferences. Please try again.");
		}
	}

	function handleSkip() {
		navigate({ to: "/" });
	}

	return (
		<div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
			<div className="mb-6">
				<p className="text-xs font-semibold uppercase tracking-wide text-(--lagoon-deep)">
					Step {step === "location" ? "1" : "2"} of 2
				</p>
				<h1 className="mt-1 text-2xl font-bold text-(--sea-ink)">
					{step === "location"
						? "Welcome — where should we look for events?"
						: "Get a weekly digest?"}
				</h1>
				<p className="mt-2 text-sm text-(--sea-ink-soft)">
					{step === "location"
						? "We'll use this to surface events near you. You can change it any time in settings."
						: "Every Friday morning we'll send you a curated list of events near you."}
				</p>
			</div>

			{step === "location" && (
				<div className="space-y-6">
					<LocationPicker value={location} onChange={setLocation} />

					{error && <p className="text-sm text-red-600">{error}</p>}

					<div className="flex items-center justify-between gap-3">
						<button
							type="button"
							onClick={handleSkip}
							className="text-sm text-(--sea-ink-soft) hover:text-(--sea-ink)"
						>
							Skip for now
						</button>
						<button
							type="button"
							onClick={handleLocationNext}
							disabled={updateSettings.isPending}
							className="rounded-md bg-(--lagoon-deep) px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-(--lagoon) disabled:opacity-50"
						>
							{updateSettings.isPending ? "Saving..." : "Continue"}
						</button>
					</div>
				</div>
			)}

			{step === "digest" && (
				<div className="space-y-6">
					<label className="flex items-start gap-3">
						<input
							type="checkbox"
							checked={emailEnabled}
							onChange={(e) => setEmailEnabled(e.target.checked)}
							className="mt-0.5 h-4 w-4 rounded border-(--line) text-(--lagoon-deep) focus:ring-(--lagoon)"
						/>
						<div>
							<span className="text-sm text-(--sea-ink)">
								Send me a weekly email digest
							</span>
							{user?.Email && (
								<p className="text-xs text-(--sea-ink-soft)">to {user.Email}</p>
							)}
						</div>
					</label>

					{emailEnabled && (
						<DigestOptInFields
							digestFormat={digestFormat}
							onDigestFormatChange={setDigestFormat}
							emailStyle={emailStyle}
							onEmailStyleChange={setEmailStyle}
							preferredCategories={preferredCategories}
							onPreferredCategoriesChange={setPreferredCategories}
						/>
					)}

					{error && <p className="text-sm text-red-600">{error}</p>}

					<div className="flex items-center justify-between gap-3">
						<button
							type="button"
							onClick={handleSkip}
							className="text-sm text-(--sea-ink-soft) hover:text-(--sea-ink)"
						>
							Skip for now
						</button>
						<button
							type="button"
							onClick={handleDigestSubmit}
							disabled={updatePrefs.isPending}
							className="rounded-md bg-(--lagoon-deep) px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-(--lagoon) disabled:opacity-50"
						>
							{updatePrefs.isPending
								? "Saving..."
								: emailEnabled
									? "Finish"
									: "Skip & finish"}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
