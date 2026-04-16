import { useState } from "react";
import { Spinner } from "#/components/Spinner";
import { useAdminStats } from "#/lib/hooks/useAdminStats";
import {
	useApproveApplication,
	usePendingApplications,
	useRejectApplication,
} from "#/lib/hooks/useApplications";
import type { AdminStats, AuthorApplication } from "#/lib/types";

function AuthorsTable({ authors }: { authors: AdminStats["authors"] }) {
	if (authors.length === 0) return null;
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

export function AdminApplicationsTab() {
	const { data: stats } = useAdminStats();
	const { data: applications, isLoading } = usePendingApplications();

	return (
		<div className="space-y-8">
			{stats?.authors && <AuthorsTable authors={stats.authors} />}

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
