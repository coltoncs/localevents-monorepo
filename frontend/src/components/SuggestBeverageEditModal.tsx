import { useState } from "react";
import { useCreateSuggestion } from "#/lib/hooks/useSuggestions";
import type { Beverage } from "#/lib/types";

const inputClass =
	"mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon) bg-(--bg-base) text-(--sea-ink)";
const labelClass = "block text-sm font-medium text-(--sea-ink-soft)";

export function SuggestBeverageEditModal({
	beverage,
	onClose,
}: {
	beverage: Beverage;
	onClose: () => void;
}) {
	const createSuggestion = useCreateSuggestion();
	const [name, setName] = useState(beverage.Name);
	const [address, setAddress] = useState(beverage.Address ?? "");
	const [city, setCity] = useState(beverage.City ?? "");
	const [state, setState] = useState(beverage.State ?? "");
	const [zip, setZip] = useState(beverage.Zip ?? "");
	const [phone, setPhone] = useState(beverage.Phone ?? "");
	const [website, setWebsite] = useState(beverage.Website ?? "");
	const [hours, setHours] = useState(beverage.Hours ?? "");
	const [description, setDescription] = useState(beverage.Description ?? "");
	const [submitted, setSubmitted] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();

		const changes: Record<string, unknown> = {};
		if (name !== beverage.Name) changes.name = name;
		if (address !== (beverage.Address ?? "")) changes.address = address;
		if (city !== (beverage.City ?? "")) changes.city = city;
		if (state !== (beverage.State ?? "")) changes.state = state;
		if (zip !== (beverage.Zip ?? "")) changes.zip = zip;
		if (phone !== (beverage.Phone ?? "")) changes.phone = phone;
		if (website !== (beverage.Website ?? "")) changes.website = website;
		if (hours !== (beverage.Hours ?? "")) changes.hours = hours;
		if (description !== (beverage.Description ?? ""))
			changes.description = description;

		if (Object.keys(changes).length === 0) {
			onClose();
			return;
		}

		await createSuggestion.mutateAsync({
			target_type: "beverage",
			target_id: beverage.ID,
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
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
			<form
				onSubmit={handleSubmit}
				className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-(--line) bg-(--surface-strong) p-6 shadow-xl space-y-4"
			>
				<h2 className="text-lg font-semibold text-(--sea-ink)">
					Suggest Beverage Edit
				</h2>
				<p className="text-sm text-(--sea-ink-soft)">
					Change the fields you think need updating. Only modified fields will
					be submitted for review.
				</p>

				<label className={labelClass}>
					Name
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className={inputClass}
					/>
				</label>

				<div className="grid grid-cols-2 gap-4">
					<label className={`col-span-2 ${labelClass}`}>
						Address
						<input
							type="text"
							value={address}
							onChange={(e) => setAddress(e.target.value)}
							className={inputClass}
						/>
					</label>
					<label className={labelClass}>
						City
						<input
							type="text"
							value={city}
							onChange={(e) => setCity(e.target.value)}
							className={inputClass}
						/>
					</label>
					<div className="flex gap-2">
						<label className={`flex-1 ${labelClass}`}>
							State
							<input
								type="text"
								value={state}
								onChange={(e) => setState(e.target.value)}
								className={inputClass}
							/>
						</label>
						<label className={`w-24 ${labelClass}`}>
							ZIP
							<input
								type="text"
								value={zip}
								onChange={(e) => setZip(e.target.value)}
								className={inputClass}
							/>
						</label>
					</div>
				</div>

				<label className={labelClass}>
					Phone
					<input
						type="text"
						value={phone}
						onChange={(e) => setPhone(e.target.value)}
						placeholder="(919) 555-1234"
						className={inputClass}
					/>
				</label>

				<label className={labelClass}>
					Website
					<input
						type="text"
						value={website}
						onChange={(e) => setWebsite(e.target.value)}
						placeholder="https://..."
						className={inputClass}
					/>
				</label>

				<label className={labelClass}>
					Hours
					<input
						type="text"
						value={hours}
						onChange={(e) => setHours(e.target.value)}
						placeholder="e.g. Mon-Sat 12pm-10pm, Sun 12pm-8pm"
						className={inputClass}
					/>
				</label>

				<label className={labelClass}>
					Description
					<textarea
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						rows={3}
						className={inputClass}
					/>
				</label>

				{createSuggestion.isError && (
					<p className="text-sm text-red-600">
						Failed to submit suggestion. Please try again.
					</p>
				)}

				<div className="flex justify-end gap-3 pt-2">
					<button
						type="button"
						onClick={onClose}
						className="cursor-pointer rounded-md border border-(--line) px-4 py-2 text-sm font-semibold text-(--sea-ink) hover:bg-(--surface)"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={createSuggestion.isPending}
						className="cursor-pointer rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-(--lagoon) disabled:opacity-50"
					>
						{createSuggestion.isPending ? "Submitting..." : "Submit Suggestion"}
					</button>
				</div>
			</form>
		</div>
	);
}
