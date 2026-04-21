import { useState } from "react";
import { emptyFoodForm, FoodForm } from "#/components/FoodForm";
import { useCreateSuggestion } from "#/lib/hooks/useSuggestions";
import type { CreateFoodInput } from "#/lib/types";

export function SuggestFoodCreateModal({ onClose }: { onClose: () => void }) {
	const createSuggestion = useCreateSuggestion();
	const [submitted, setSubmitted] = useState(false);

	async function handleSubmit(data: CreateFoodInput) {
		const payload: Record<string, unknown> = {
			name: data.name,
			cuisine: data.cuisine,
			latitude: data.latitude,
			longitude: data.longitude,
		};
		if (data.address) payload.address = data.address;
		if (data.city) payload.city = data.city;
		if (data.state) payload.state = data.state;
		if (data.zip) payload.zip = data.zip;
		if (data.phone) payload.phone = data.phone;
		if (data.website) payload.website = data.website;
		if (data.hours) payload.hours = data.hours;
		if (data.description) payload.description = data.description;
		if (data.review) payload.review = data.review;
		if (data.image_url) payload.image_url = data.image_url;
		if (data.tags && data.tags.length > 0) payload.tags = data.tags;
		if (data.price_level !== undefined) payload.price_level = data.price_level;

		await createSuggestion.mutateAsync({
			target_type: "food",
			action: "create",
			proposed_changes: payload,
		});
		setSubmitted(true);
	}

	if (submitted) {
		return (
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
				<div className="w-full max-w-lg rounded-lg border border-(--line) bg-(--surface-strong) p-6 text-center shadow-xl">
					<p className="text-lg font-semibold text-(--sea-ink)">
						Suggestion submitted
					</p>
					<p className="mt-1 text-sm text-(--sea-ink-soft)">
						Thanks! An admin will review your suggested restaurant before it
						appears on the map.
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
						Suggest a Restaurant
					</h2>
					<p className="text-sm text-(--sea-ink-soft)">
						Fill in what you know. An admin will review and publish it.
					</p>
				</div>

				<FoodForm
					initial={emptyFoodForm()}
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
