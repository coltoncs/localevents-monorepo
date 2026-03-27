import { useAuth } from "@clerk/clerk-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNotificationPreferences } from "#/lib/hooks/useNotifications";

const STORAGE_KEY = "email-notif-banner-dismissed";

export function EmailNotifBanner() {
	const { isSignedIn } = useAuth();
	const [dismissed, setDismissed] = useState(true);
	const { data: prefs, isLoading } = useNotificationPreferences();

	useEffect(() => {
		setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
	}, []);

	if (!isSignedIn || dismissed || isLoading || !prefs || prefs.email_enabled) {
		return null;
	}

	function handleDismiss() {
		localStorage.setItem(STORAGE_KEY, "1");
		setDismissed(true);
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
				<button
					type="button"
					onClick={handleDismiss}
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
			</div>
		</div>
	);
}
