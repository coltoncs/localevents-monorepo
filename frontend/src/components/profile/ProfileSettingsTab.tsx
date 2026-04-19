import { Link } from "@tanstack/react-router";
import { NotificationSettings } from "#/components/NotificationSettings";
import { SettingsForm } from "#/components/SettingsForm";

export function ProfileSettingsTab() {
	return (
		<div className="mx-auto max-w-xl space-y-4">
			<div className="rounded-lg border border-(--line) bg-(--surface-strong) p-6">
				<SettingsForm />
			</div>
			<div className="rounded-lg border border-(--line) bg-(--surface-strong) p-6">
				<h2 className="mb-3 text-lg font-semibold text-(--sea-ink)">
					Notifications
				</h2>
				<NotificationSettings />
			</div>
			<div className="rounded-lg border border-(--line) bg-(--surface-strong) p-6">
				<h2 className="text-lg font-semibold text-(--sea-ink)">Subscription</h2>
				<p className="mt-1 text-sm text-(--sea-ink-soft)">
					Support 919Events with a small monthly donation.
				</p>
				<Link
					to="/donate"
					className="mt-3 inline-block rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-semibold text-white! no-underline hover:bg-(--lagoon)"
				>
					Manage subscription
				</Link>
			</div>
		</div>
	);
}
