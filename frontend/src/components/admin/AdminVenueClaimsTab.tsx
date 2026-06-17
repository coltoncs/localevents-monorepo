import { useState } from "react";
import { Spinner } from "#/components/Spinner";
import {
	useApproveVenueClaim,
	usePendingVenueClaims,
	useRejectVenueClaim,
} from "#/lib/hooks/useVenueClaims";
import type { VenueClaim } from "#/lib/types";

function ClaimCard({ claim }: { claim: VenueClaim }) {
	const approve = useApproveVenueClaim();
	const reject = useRejectVenueClaim();
	const [reviewNotes, setReviewNotes] = useState("");
	const [showReject, setShowReject] = useState(false);

	const isExisting = !!claim.VenueID;
	const address = [claim.Address, claim.City, claim.State, claim.Zip]
		.filter(Boolean)
		.join(", ");

	return (
		<div className="space-y-3 rounded-lg border border-(--line) bg-(--surface-strong) p-4">
			<div className="flex items-start justify-between gap-2">
				<div>
					<h3 className="font-semibold text-(--sea-ink)">{claim.VenueName}</h3>
					<span className="text-xs text-(--sea-ink-soft)">
						{isExisting ? "Claim existing venue" : "New venue"}
					</span>
				</div>
				<span className="text-xs text-(--sea-ink-soft)">
					{new Date(claim.SubmittedAt).toLocaleDateString()}
				</span>
			</div>

			<div className="space-y-1 text-sm">
				<p className="text-(--sea-ink)">
					<span className="text-(--sea-ink-soft)">Contact:</span>{" "}
					{claim.ContactName} ({claim.ContactEmail})
				</p>
				{claim.BookingEmail && (
					<p className="text-(--sea-ink)">
						<span className="text-(--sea-ink-soft)">Booking email:</span>{" "}
						{claim.BookingEmail}
					</p>
				)}
				{!isExisting && address && (
					<p className="text-(--sea-ink)">
						<span className="text-(--sea-ink-soft)">Address:</span> {address}
					</p>
				)}
				{claim.Message && (
					<p className="text-(--sea-ink)">
						<span className="text-(--sea-ink-soft)">Message:</span>{" "}
						{claim.Message}
					</p>
				)}
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
						approve.mutate({ id: claim.ID, review_notes: reviewNotes })
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
							reject.mutate({ id: claim.ID, review_notes: reviewNotes })
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

export function AdminVenueClaimsTab() {
	const { data: claims, isLoading } = usePendingVenueClaims();

	return (
		<div>
			<h2 className="mb-4 text-xl font-bold text-(--sea-ink)">
				Pending Venue Claims
				{claims && claims.length > 0 && (
					<span className="ml-2 inline-flex items-center rounded-full bg-[rgba(79,184,178,0.14)] px-2.5 py-0.5 text-sm font-medium text-(--lagoon-deep)">
						{claims.length}
					</span>
				)}
			</h2>

			{isLoading && <Spinner className="py-12" />}

			{claims && claims.length === 0 && (
				<p className="py-8 text-center text-(--sea-ink-soft)">
					No pending venue claims.
				</p>
			)}

			<div className="space-y-4">
				{claims?.map((claim) => (
					<ClaimCard key={claim.ID} claim={claim} />
				))}
			</div>
		</div>
	);
}
