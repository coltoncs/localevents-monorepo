import { useMutation } from "@tanstack/react-query";
import { apiClient } from "#/lib/api";
import { useAdminStats } from "#/lib/hooks/useAdminStats";
import type { AdminStats } from "#/lib/types";

function CronStatusPanel({
	lastScrape,
	lastCleanup,
}: {
	lastScrape: AdminStats["last_scrape"];
	lastCleanup: AdminStats["last_cleanup"];
}) {
	return (
		<div className="rounded-lg border border-(--line) bg-(--surface-strong) p-4 space-y-2">
			<h3 className="font-semibold text-(--sea-ink)">Cron Jobs</h3>
			{lastScrape ? (
				<p className="text-sm text-(--sea-ink)">
					Last scrape:{" "}
					<span className="font-medium">
						{lastScrape.items_affected} events
					</span>
					{lastScrape.details?.mirrored
						? `, ${lastScrape.details.mirrored} images`
						: ""}
					<span className="text-(--sea-ink-soft)">
						{" "}
						— {new Date(lastScrape.ran_at).toLocaleString()}
					</span>
				</p>
			) : (
				<p className="text-sm text-(--sea-ink-soft)">No scrape data yet.</p>
			)}
			{lastCleanup ? (
				<p className="text-sm text-(--sea-ink)">
					Last cleanup:{" "}
					<span className="font-medium">
						{lastCleanup.items_affected} events removed
					</span>
					{lastCleanup.details?.images_deleted
						? `, ${lastCleanup.details.images_deleted} images`
						: ""}
					<span className="text-(--sea-ink-soft)">
						{" "}
						— {new Date(lastCleanup.ran_at).toLocaleString()}
					</span>
				</p>
			) : (
				<p className="text-sm text-(--sea-ink-soft)">No cleanup data yet.</p>
			)}
		</div>
	);
}

function DigestTrigger() {
	const trigger = useMutation({
		mutationFn: () =>
			apiClient<{ status: string }>("/api/admin/digest/trigger", {
				method: "POST",
			}),
	});

	return (
		<div className="rounded-lg border border-(--line) bg-(--surface-strong) p-4">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="font-semibold text-(--sea-ink)">Weekly Digest</h3>
					<p className="text-sm text-(--sea-ink-soft)">
						Send the weekly event digest to all subscribed users now.
					</p>
				</div>
				<button
					type="button"
					onClick={() => trigger.mutate()}
					disabled={trigger.isPending}
					className="cursor-pointer rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-semibold text-white hover:bg-(--lagoon) disabled:opacity-50"
				>
					{trigger.isPending ? "Sending..." : "Send Digest"}
				</button>
			</div>
			{trigger.isSuccess && (
				<p className="mt-2 text-sm text-green-600">
					Digest triggered successfully. Check server logs for details.
				</p>
			)}
			{trigger.isError && (
				<p className="mt-2 text-sm text-red-600">Failed to trigger digest.</p>
			)}
		</div>
	);
}

export function AdminOpsTab() {
	const { data: stats } = useAdminStats();

	return (
		<div className="space-y-6">
			{stats && (
				<CronStatusPanel
					lastScrape={stats.last_scrape}
					lastCleanup={stats.last_cleanup}
				/>
			)}
			<DigestTrigger />
		</div>
	);
}
