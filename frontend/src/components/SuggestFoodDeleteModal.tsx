import { useState } from "react";
import { useCreateSuggestion } from "#/lib/hooks/useSuggestions";
import type { Food } from "#/lib/types";

export function SuggestFoodDeleteModal({
	food,
	onClose,
}: {
	food: Food;
	onClose: () => void;
}) {
	const createSuggestion = useCreateSuggestion();
	const [reason, setReason] = useState("");
	const [submitted, setSubmitted] = useState(false);

	const trimmed = reason.trim();
	const canSubmit = trimmed.length > 0;

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!canSubmit) return;
		await createSuggestion.mutateAsync({
			target_type: "food",
			target_id: food.ID,
			action: "delete",
			reason: trimmed,
			proposed_changes: {},
		});
		setSubmitted(true);
	}

	if (submitted) {
		return (
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
				<div className="w-full max-w-md rounded-lg border border-(--line) bg-(--surface-strong) p-6 text-center shadow-xl">
					<p className="text-lg font-semibold text-(--sea-ink)">
						Report submitted
					</p>
					<p className="mt-1 text-sm text-(--sea-ink-soft)">
						Thanks for the tip. An admin will review and remove this listing if
						appropriate.
					</p>
					<button
						type="button"
						onClick={onClose}
						className="mt-4 cursor-pointer rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-semibold text-white hover:bg-(--lagoon)"
					>
						Close
					</button>
				</div>
			</div>
		);
	}

	const locationLabel =
		[food.City, food.State].filter(Boolean).join(", ") || food.Address || "";

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
			<form
				onSubmit={handleSubmit}
				className="w-full max-w-md rounded-lg border border-(--line) bg-(--surface-strong) p-6 shadow-xl space-y-4"
			>
				<h2 className="text-lg font-semibold text-(--sea-ink)">
					Report as Closed
				</h2>
				<div className="rounded-md border border-(--line) bg-(--surface) px-3 py-2 text-sm">
					<p className="font-medium text-(--sea-ink)">{food.Name}</p>
					{locationLabel && (
						<p className="text-(--sea-ink-soft)">{locationLabel}</p>
					)}
				</div>

				<label className="block text-sm font-medium text-(--sea-ink-soft)">
					Reason *
					<textarea
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						rows={4}
						required
						placeholder="e.g. Permanently closed in March 2026."
						className="mt-1 block w-full rounded-md border border-(--line) bg-(--bg-base) px-3 py-2 text-sm text-(--sea-ink) shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)"
					/>
				</label>

				{createSuggestion.isError && (
					<p className="text-sm text-red-600">
						Failed to submit. Please try again.
					</p>
				)}

				<div className="flex justify-end gap-3">
					<button
						type="button"
						onClick={onClose}
						className="cursor-pointer rounded-md border border-(--line) px-4 py-2 text-sm font-semibold text-(--sea-ink) hover:bg-(--surface)"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={!canSubmit || createSuggestion.isPending}
						className="cursor-pointer rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
					>
						{createSuggestion.isPending ? "Submitting..." : "Submit Report"}
					</button>
				</div>
			</form>
		</div>
	);
}
