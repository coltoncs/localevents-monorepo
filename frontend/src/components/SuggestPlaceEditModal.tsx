import { useState } from "react";
import { PlaceForm, placeToForm } from "#/components/PlaceForm";
import { useCreateSuggestion } from "#/lib/hooks/useSuggestions";
import type { CreatePlaceInput, Place } from "#/lib/types";

export function SuggestPlaceEditModal({
	place,
	onClose,
}: {
	place: Place;
	onClose: () => void;
}) {
	const createSuggestion = useCreateSuggestion();
	const [submitted, setSubmitted] = useState(false);

	async function handleSubmit(data: CreatePlaceInput) {
		const changes: Record<string, unknown> = {};
		if (data.name !== place.Name) changes.name = data.name;
		if (data.is_food !== place.IsFood) changes.is_food = data.is_food;
		if (data.is_drink !== place.IsDrink) changes.is_drink = data.is_drink;
		if (data.is_food && data.cuisine !== place.Cuisine) {
			changes.cuisine = data.cuisine;
		}
		if (data.is_drink && data.bar_type !== place.BarType) {
			changes.bar_type = data.bar_type;
		}
		if ((data.address ?? "") !== (place.Address ?? "")) {
			changes.address = data.address ?? "";
		}
		if ((data.city ?? "") !== (place.City ?? "")) {
			changes.city = data.city ?? "";
		}
		if ((data.state ?? "") !== (place.State ?? "")) {
			changes.state = data.state ?? "";
		}
		if ((data.zip ?? "") !== (place.Zip ?? "")) {
			changes.zip = data.zip ?? "";
		}
		if ((data.phone ?? "") !== (place.Phone ?? "")) {
			changes.phone = data.phone ?? "";
		}
		if ((data.website ?? "") !== (place.Website ?? "")) {
			changes.website = data.website ?? "";
		}
		if ((data.hours ?? "") !== (place.Hours ?? "")) {
			changes.hours = data.hours ?? "";
		}
		if ((data.description ?? "") !== (place.Description ?? "")) {
			changes.description = data.description ?? "";
		}

		if (Object.keys(changes).length === 0) {
			onClose();
			return;
		}

		await createSuggestion.mutateAsync({
			target_type: "place",
			target_id: place.ID,
			proposed_changes: changes,
		});
		setSubmitted(true);
	}

	if (submitted) {
		return (
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
				<div className="w-full max-w-lg rounded-lg border border-(--line) bg-(--surface-strong) p-6 text-center shadow-xl">
					<p className="text-lg font-semibold text-(--sea-ink)">
						Edit suggestion submitted
					</p>
					<p className="mt-1 text-sm text-(--sea-ink-soft)">
						An admin will review your suggested changes.
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

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
			<div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-(--line) bg-(--surface-strong) p-6 shadow-xl space-y-4">
				<div>
					<h2 className="text-lg font-semibold text-(--sea-ink)">
						Suggest Edit
					</h2>
					<p className="text-sm text-(--sea-ink-soft)">
						Change anything that needs updating. Only modified fields will be
						submitted for review.
					</p>
				</div>

				<PlaceForm
					initial={placeToForm(place)}
					onSubmit={handleSubmit}
					onCancel={onClose}
					isPending={createSuggestion.isPending}
					isError={createSuggestion.isError}
					submitLabel="Submit Suggestion"
				/>
			</div>
		</div>
	);
}
