import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RoleProtectedRoute } from "#/components/RoleProtectedRoute";
import { Spinner } from "#/components/Spinner";
import { SuggestionCard } from "#/components/SuggestionCard";
import { apiClient } from "#/lib/api";
import { useAdminStats } from "#/lib/hooks/useAdminStats";
import {
	useApproveApplication,
	usePendingApplications,
	useRejectApplication,
} from "#/lib/hooks/useApplications";
import { usePendingSuggestions } from "#/lib/hooks/useSuggestions";
import type { AdminStats, AuthorApplication } from "#/lib/types";

export const Route = createFileRoute("/admin")({
	component: AdminPage,
});

function AdminPage() {
	return (
		<RoleProtectedRoute roles={["admin"]}>
			<AdminContent />
		</RoleProtectedRoute>
	);
}

// ── Metric Card ──────────────────────────────────────────────

function MetricCard({
	label,
	value,
}: {
	label: string;
	value: string | number;
}) {
	return (
		<div className="rounded-lg border border-(--line) bg-(--surface-strong) p-4">
			<p className="text-sm text-(--sea-ink-soft)">{label}</p>
			<p className="mt-1 text-2xl font-bold text-(--sea-ink)">{value}</p>
		</div>
	);
}

// ── Event Sources ────────────────────────────────────────────

function EventSourcesPanel({
	sources,
}: {
	sources: AdminStats["events_by_source"];
}) {
	const total = sources.reduce((sum, s) => sum + s.count, 0);
	return (
		<div className="rounded-lg border border-(--line) bg-(--surface-strong) p-4">
			<h3 className="font-semibold text-(--sea-ink)">Events by Source</h3>
			{sources.length === 0 ? (
				<p className="mt-2 text-sm text-(--sea-ink-soft)">
					No upcoming events.
				</p>
			) : (
				<div className="mt-3 space-y-2">
					{sources.map((s) => (
						<div
							key={s.source}
							className="flex items-center justify-between text-sm"
						>
							<span className="text-(--sea-ink)">{s.source}</span>
							<div className="flex items-center gap-2">
								<div
									className="h-2 rounded-full bg-[rgba(79,184,178,0.3)]"
									style={{ width: `${Math.max((s.count / total) * 120, 8)}px` }}
								/>
								<span className="tabular-nums text-(--sea-ink-soft)">
									{s.count}
								</span>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

// ── Digest Stats ─────────────────────────────────────────────

function DigestStatsPanel({
	digests,
	lastScrape,
	lastCleanup,
}: {
	digests: AdminStats["recent_digests"];
	lastScrape: AdminStats["last_scrape"];
	lastCleanup: AdminStats["last_cleanup"];
}) {
	return (
		<div className="rounded-lg border border-(--line) bg-(--surface-strong) p-4 space-y-4">
			<div>
				<h3 className="font-semibold text-(--sea-ink)">
					Digest Stats (7 days)
				</h3>
				<div className="mt-2 grid grid-cols-3 gap-3 text-center">
					<div>
						<p className="text-lg font-bold text-green-600">{digests.sent}</p>
						<p className="text-xs text-(--sea-ink-soft)">Sent</p>
					</div>
					<div>
						<p className="text-lg font-bold text-red-500">{digests.failed}</p>
						<p className="text-xs text-(--sea-ink-soft)">Failed</p>
					</div>
					<div>
						<p className="text-lg font-bold text-(--sea-ink)">
							{digests.total_events_included}
						</p>
						<p className="text-xs text-(--sea-ink-soft)">Events Sent</p>
					</div>
				</div>
			</div>

			<div className="border-t border-(--line) pt-3 space-y-2">
				<h4 className="text-sm font-medium text-(--sea-ink-soft)">Cron Jobs</h4>
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
		</div>
	);
}

// ── Authors Table ────────────────────────────────────────────

function AuthorsTable({ authors }: { authors: AdminStats["authors"] }) {
	if (authors.length === 0) {
		return null;
	}
	return (
		<div className="rounded-lg border border-(--line) bg-(--surface-strong) overflow-hidden">
			<div className="px-4 py-3 border-b border-(--line)">
				<h3 className="font-semibold text-(--sea-ink)">Authors</h3>
			</div>
			<table className="w-full text-sm">
				<thead>
					<tr className="border-b border-(--line) text-left text-(--sea-ink-soft)">
						<th className="px-4 py-2 font-medium">Name</th>
						<th className="px-4 py-2 font-medium">Email</th>
						<th className="px-4 py-2 font-medium text-right">
							Upcoming Events
						</th>
					</tr>
				</thead>
				<tbody>
					{authors.map((a) => (
						<tr
							key={a.email}
							className="border-b border-(--line) last:border-0"
						>
							<td className="px-4 py-2 text-(--sea-ink)">{a.name}</td>
							<td className="px-4 py-2 text-(--sea-ink-soft)">{a.email}</td>
							<td className="px-4 py-2 text-right tabular-nums text-(--sea-ink)">
								{a.event_count}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

// ── Preserved components ─────────────────────────────────────

function ApplicationCard({ app }: { app: AuthorApplication }) {
	const approve = useApproveApplication();
	const reject = useRejectApplication();
	const [reviewNotes, setReviewNotes] = useState("");
	const [showReject, setShowReject] = useState(false);

	return (
		<div className="rounded-lg border border-(--line) bg-(--surface-strong) p-4 space-y-3">
			<div className="flex items-start justify-between">
				<div>
					<h3 className="font-semibold text-(--sea-ink)">{app.FullName}</h3>
					<p className="text-sm text-(--sea-ink-soft)">{app.Email}</p>
				</div>
				<span className="text-xs text-(--sea-ink-soft)">
					{new Date(app.SubmittedAt).toLocaleDateString()}
				</span>
			</div>

			<div>
				<h4 className="text-sm font-medium text-(--sea-ink-soft)">Bio</h4>
				<p className="text-sm text-(--sea-ink)">{app.Bio}</p>
			</div>

			<div>
				<h4 className="text-sm font-medium text-(--sea-ink-soft)">
					Experience
				</h4>
				<p className="text-sm text-(--sea-ink)">{app.Experience}</p>
			</div>

			{showReject && (
				<label className="block text-sm font-medium text-(--sea-ink-soft)">
					Review Notes (optional)
					<textarea
						value={reviewNotes}
						onChange={(e) => setReviewNotes(e.target.value)}
						rows={2}
						className="mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)"
					/>
				</label>
			)}

			<div className="flex gap-2">
				<button
					type="button"
					onClick={() =>
						approve.mutate({ id: app.ID, review_notes: reviewNotes })
					}
					disabled={approve.isPending}
					className="cursor-pointer rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
				>
					{approve.isPending ? "Approving..." : "Approve"}
				</button>
				{!showReject ? (
					<button
						type="button"
						onClick={() => setShowReject(true)}
						className="cursor-pointer rounded-md border border-red-300 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
					>
						Reject
					</button>
				) : (
					<button
						type="button"
						onClick={() =>
							reject.mutate({ id: app.ID, review_notes: reviewNotes })
						}
						disabled={reject.isPending}
						className="cursor-pointer rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
					>
						{reject.isPending ? "Rejecting..." : "Confirm Reject"}
					</button>
				)}
			</div>
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

// ── Main Layout ──────────────────────────────────────────────

function AdminContent() {
	const { data: stats, isLoading: statsLoading } = useAdminStats();
	const { data: applications, isLoading } = usePendingApplications();
	const { data: suggestions, isLoading: suggestionsLoading } =
		usePendingSuggestions();

	return (
		<div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
			<h1 className="text-2xl font-bold text-(--sea-ink)">Admin Dashboard</h1>

			{/* Metrics grid */}
			{statsLoading ? (
				<Spinner className="py-12" />
			) : stats ? (
				<>
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
						<MetricCard label="Total Users" value={stats.total_users} />
						<MetricCard
							label="Weekly Active"
							value={stats.weekly_active_users}
						/>
						<MetricCard
							label="New This Week"
							value={stats.new_users_this_week}
						/>
						<MetricCard
							label="Email Subscribers"
							value={stats.email_subscribers}
						/>
						<MetricCard label="SMS Subscribers" value={stats.sms_subscribers} />
						<MetricCard
							label="Upcoming Events"
							value={stats.total_upcoming_events}
						/>
						<MetricCard label="Venues" value={stats.total_venues} />
						<MetricCard label="Total Saves" value={stats.total_saved_events} />
					</div>

					<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
						<EventSourcesPanel sources={stats.events_by_source} />
						<DigestStatsPanel
							digests={stats.recent_digests}
							lastScrape={stats.last_scrape}
							lastCleanup={stats.last_cleanup}
						/>
					</div>

					<AuthorsTable authors={stats.authors} />
				</>
			) : null}

			{/* Actions */}
			<DigestTrigger />

			{/* Pending Edit Suggestions */}
			<div>
				<h2 className="mb-4 text-xl font-bold text-(--sea-ink)">
					Pending Edit Suggestions
					{stats && stats.pending_suggestions > 0 && (
						<span className="ml-2 inline-flex items-center rounded-full bg-[rgba(79,184,178,0.14)] px-2.5 py-0.5 text-sm font-medium text-(--lagoon-deep)">
							{stats.pending_suggestions}
						</span>
					)}
				</h2>

				{suggestionsLoading && <Spinner className="py-12" />}

				{suggestions && suggestions.length === 0 && (
					<p className="py-8 text-center text-(--sea-ink-soft)">
						No pending edit suggestions.
					</p>
				)}

				<div className="space-y-4">
					{suggestions?.map((s) => (
						<SuggestionCard key={s.ID} suggestion={s} />
					))}
				</div>
			</div>

			{/* Pending Applications */}
			<div>
				<h2 className="mb-4 text-xl font-bold text-(--sea-ink)">
					Pending Applications
					{stats && stats.pending_applications > 0 && (
						<span className="ml-2 inline-flex items-center rounded-full bg-[rgba(79,184,178,0.14)] px-2.5 py-0.5 text-sm font-medium text-(--lagoon-deep)">
							{stats.pending_applications}
						</span>
					)}
				</h2>

				{isLoading && <Spinner className="py-12" />}

				{applications && applications.length === 0 && (
					<p className="py-8 text-center text-(--sea-ink-soft)">
						No pending applications.
					</p>
				)}

				<div className="space-y-4">
					{applications?.map((app) => (
						<ApplicationCard key={app.ID} app={app} />
					))}
				</div>
			</div>
		</div>
	);
}
