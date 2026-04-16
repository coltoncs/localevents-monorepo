import { useState } from "react";
import {
	useApproveSuggestion,
	useRejectSuggestion,
} from "#/lib/hooks/useSuggestions";
import type { EditSuggestion } from "#/lib/types";

const fieldLabels: Record<string, string> = {
	title: "Title",
	description: "Description",
	venue_name: "Venue Name",
	name: "Name",
	type: "Type",
	address: "Address",
	city: "City",
	state: "State",
	zip: "ZIP",
	latitude: "Latitude",
	longitude: "Longitude",
	start_time: "Start Time",
	end_time: "End Time",
	categories: "Categories",
	image_url: "Image URL",
	ticket_url: "Ticket URL",
	price_min: "Min Price",
	price_max: "Max Price",
	hours: "Hours",
	phone: "Phone",
	website: "Website",
	review: "Review",
	tags: "Tags",
	price_level: "Price Level",
};

function formatValue(value: unknown): string {
	if (value == null || value === "") return "(empty)";
	if (Array.isArray(value)) return value.join(", ");
	return String(value);
}

function targetTypeLabel(t: EditSuggestion["TargetType"]): string {
	if (t === "event") return "Event";
	if (t === "venue") return "Venue";
	return "Bar/Brewery";
}

function actionHeading(s: EditSuggestion): string {
	const target = targetTypeLabel(s.TargetType);
	if (s.Action === "create") return `New ${target} proposed`;
	if (s.Action === "delete") return `${target} deletion proposed`;
	return `${target} edit suggestion`;
}

function actionBadgeClass(action: EditSuggestion["Action"]): string {
	if (action === "create")
		return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
	if (action === "delete")
		return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
	return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
}

export function SuggestionCard({ suggestion }: { suggestion: EditSuggestion }) {
	const approve = useApproveSuggestion();
	const reject = useRejectSuggestion();
	const [reviewNotes, setReviewNotes] = useState("");
	const [showReject, setShowReject] = useState(false);

	const changes = suggestion.ProposedChanges ?? {};
	const action = suggestion.Action ?? "edit";
	const title =
		action === "create"
			? (changes.name as string) || "New listing"
			: suggestion.TargetName || suggestion.TargetID || "(unknown)";

	const approveLabel =
		action === "create"
			? approve.isPending
				? "Creating..."
				: "Approve & Create"
			: action === "delete"
				? approve.isPending
					? "Deleting..."
					: "Approve & Delete"
				: approve.isPending
					? "Approving..."
					: "Approve";

	return (
		<div className="rounded-lg border border-(--line) bg-(--surface-strong) p-4 space-y-3">
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className="flex items-center gap-2">
						<h3 className="font-semibold text-(--sea-ink)">{title}</h3>
						<span
							className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${actionBadgeClass(action)}`}
						>
							{action}
						</span>
					</div>
					<p className="text-xs text-(--sea-ink-soft)">
						{actionHeading(suggestion)}
					</p>
				</div>
				<span className="text-xs text-(--sea-ink-soft) shrink-0">
					{new Date(suggestion.CreatedAt).toLocaleDateString()}
				</span>
			</div>

			{action === "delete" && suggestion.Reason && (
				<div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
					<span className="font-medium">Reason:</span> {suggestion.Reason}
				</div>
			)}

			{action !== "delete" && Object.keys(changes).length > 0 && (
				<div className="space-y-1.5">
					<h4 className="text-sm font-medium text-(--sea-ink-soft)">
						{action === "create" ? "Details" : "Proposed Changes"}
					</h4>
					{Object.entries(changes).map(([key, value]) => (
						<div key={key} className="flex gap-2 text-sm">
							<span className="font-medium text-(--sea-ink-soft) shrink-0">
								{fieldLabels[key] || key}:
							</span>
							<span className="text-(--sea-ink) break-all">
								{formatValue(value)}
							</span>
						</div>
					))}
				</div>
			)}

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
						approve.mutate({ id: suggestion.ID, review_notes: reviewNotes })
					}
					disabled={approve.isPending}
					className={`cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
						action === "delete"
							? "bg-red-600 hover:bg-red-700"
							: "bg-green-600 hover:bg-green-700"
					}`}
				>
					{approveLabel}
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
							reject.mutate({ id: suggestion.ID, review_notes: reviewNotes })
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
