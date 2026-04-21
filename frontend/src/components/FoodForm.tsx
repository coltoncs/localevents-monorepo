import { useEffect, useRef, useState } from "react";
import { LocationPickerMap } from "#/components/LocationPickerMap";
import { getSavedLocation } from "#/components/LocationSearch";
import { CUISINES } from "#/lib/cuisines";
import type { CreateFoodInput, Food } from "#/lib/types";

const inputClass =
	"mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm shadow-sm focus:border-[var(--lagoon)] focus:ring-[var(--lagoon)]";
const labelClass = "block text-sm font-medium text-[var(--sea-ink-soft)]";

export function emptyFoodForm(): CreateFoodInput {
	const saved = getSavedLocation();
	return {
		name: "",
		cuisine: "american",
		latitude: saved?.lat ?? 0,
		longitude: saved?.lng ?? 0,
	};
}

export function foodToForm(f: Food): CreateFoodInput {
	return {
		name: f.Name,
		cuisine: f.Cuisine,
		address: f.Address || undefined,
		city: f.City || undefined,
		state: f.State || undefined,
		zip: f.Zip || undefined,
		latitude: f.Latitude,
		longitude: f.Longitude,
		phone: f.Phone || undefined,
		website: f.Website || undefined,
		hours: f.Hours || undefined,
		description: f.Description || undefined,
		review: f.Review || undefined,
		image_url: f.ImageUrl || undefined,
		tags: f.Tags ?? [],
		price_level: f.PriceLevel ?? undefined,
	};
}

function useAddressGeocode(
	setLat: (v: number) => void,
	setLng: (v: number) => void,
) {
	const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
	const lastQueryRef = useRef("");

	const geocode = (
		address: string,
		city: string,
		state: string,
		zip: string,
	) => {
		if (!address || !city || !state) return;
		const query = `${address}, ${city}, ${state} ${zip}`.trim();
		if (query === lastQueryRef.current) return;
		lastQueryRef.current = query;

		clearTimeout(timerRef.current);
		timerRef.current = setTimeout(async () => {
			try {
				const params = new URLSearchParams({
					q: query,
					format: "json",
					limit: "1",
					countrycodes: "us",
				});
				const resp = await fetch(
					`https://nominatim.openstreetmap.org/search?${params}`,
					{ headers: { "User-Agent": "919events.com" } },
				);
				const results = await resp.json();
				if (results.length > 0) {
					setLat(Number.parseFloat(results[0].lat));
					setLng(Number.parseFloat(results[0].lon));
				}
			} catch {
				// Silent fail — user can place the pin manually.
			}
		}, 800);
	};

	useEffect(() => () => clearTimeout(timerRef.current), []);
	return geocode;
}

export function FoodForm({
	initial,
	onSubmit,
	onCancel,
	isPending,
	isError,
	submitLabel,
}: {
	initial: CreateFoodInput;
	onSubmit: (data: CreateFoodInput) => void;
	onCancel: () => void;
	isPending: boolean;
	isError: boolean;
	submitLabel: string;
}) {
	const [form, setForm] = useState(initial);
	const [tagsInput, setTagsInput] = useState((initial.tags ?? []).join(", "));

	function set<K extends keyof CreateFoodInput>(
		key: K,
		value: CreateFoodInput[K],
	) {
		setForm((prev) => ({ ...prev, [key]: value }));
	}

	const geocode = useAddressGeocode(
		(lat) => setForm((prev) => ({ ...prev, latitude: lat })),
		(lng) => setForm((prev) => ({ ...prev, longitude: lng })),
	);

	const prevAddressRef = useRef("");
	useEffect(() => {
		const key = `${form.address ?? ""}|${form.city ?? ""}|${form.state ?? ""}|${form.zip ?? ""}`;
		if (key !== prevAddressRef.current) {
			prevAddressRef.current = key;
			geocode(
				form.address ?? "",
				form.city ?? "",
				form.state ?? "",
				form.zip ?? "",
			);
		}
	}, [form.address, form.city, form.state, form.zip, geocode]);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const tags = tagsInput
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean);
		onSubmit({ ...form, tags: tags.length > 0 ? tags : undefined });
	}

	return (
		<form
			onSubmit={handleSubmit}
			className="rounded-lg border border-(--line) bg-(--surface-strong) p-4 space-y-4"
		>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<label className={labelClass}>
					Name *
					<input
						type="text"
						value={form.name}
						onChange={(e) => set("name", e.target.value)}
						required
						className={inputClass}
					/>
				</label>
				<label className={labelClass}>
					Cuisine *
					<select
						value={form.cuisine}
						onChange={(e) =>
							set("cuisine", e.target.value as CreateFoodInput["cuisine"])
						}
						className={inputClass}
					>
						{CUISINES.map((c) => (
							<option key={c.value} value={c.value}>
								{c.label}
							</option>
						))}
					</select>
				</label>

				<label className={`sm:col-span-2 ${labelClass}`}>
					Address
					<input
						type="text"
						value={form.address ?? ""}
						onChange={(e) => set("address", e.target.value || undefined)}
						className={inputClass}
					/>
				</label>
				<label className={labelClass}>
					City
					<input
						type="text"
						value={form.city ?? ""}
						onChange={(e) => set("city", e.target.value || undefined)}
						className={inputClass}
					/>
				</label>
				<div className="flex gap-4">
					<label className={`flex-1 ${labelClass}`}>
						State
						<select
							value={form.state ?? ""}
							onChange={(e) => set("state", e.target.value || undefined)}
							className={inputClass}
						>
							<option value="">--</option>
							<option value="NC">NC</option>
							<option value="SC">SC</option>
							<option value="VA">VA</option>
						</select>
					</label>
					<label className={`w-28 ${labelClass}`}>
						ZIP
						<input
							type="text"
							value={form.zip ?? ""}
							onChange={(e) => set("zip", e.target.value || undefined)}
							className={inputClass}
						/>
					</label>
				</div>

				<div className="sm:col-span-2">
					<span className={labelClass}>Pin Location *</span>
					<LocationPickerMap
						lat={form.latitude || 0}
						lng={form.longitude || 0}
						onCoordinateChange={(newLat, newLng) => {
							setForm((prev) => ({
								...prev,
								latitude: newLat,
								longitude: newLng,
							}));
						}}
						className="mt-1 h-[300px] w-full rounded-md"
					/>
				</div>

				<label className={labelClass}>
					Latitude *
					<input
						type="number"
						step="any"
						value={form.latitude || ""}
						onChange={(e) => set("latitude", Number(e.target.value))}
						required
						className={inputClass}
					/>
				</label>
				<label className={labelClass}>
					Longitude *
					<input
						type="number"
						step="any"
						value={form.longitude || ""}
						onChange={(e) => set("longitude", Number(e.target.value))}
						required
						className={inputClass}
					/>
				</label>

				<label className={labelClass}>
					Phone
					<input
						type="text"
						value={form.phone ?? ""}
						onChange={(e) => set("phone", e.target.value || undefined)}
						placeholder="(919) 555-1234"
						className={inputClass}
					/>
				</label>
				<label className={labelClass}>
					Website
					<input
						type="text"
						value={form.website ?? ""}
						onChange={(e) => set("website", e.target.value || undefined)}
						placeholder="https://..."
						className={inputClass}
					/>
				</label>

				<label className={`sm:col-span-2 ${labelClass}`}>
					Hours
					<input
						type="text"
						value={form.hours ?? ""}
						onChange={(e) => set("hours", e.target.value || undefined)}
						placeholder="e.g. Mon-Sat 11am-10pm, Sun 11am-8pm"
						className={inputClass}
					/>
				</label>

				<label className={labelClass}>
					Image URL
					<input
						type="text"
						value={form.image_url ?? ""}
						onChange={(e) => set("image_url", e.target.value || undefined)}
						className={inputClass}
					/>
				</label>
				<label className={labelClass}>
					Price Level (1-4)
					<select
						value={form.price_level ?? ""}
						onChange={(e) =>
							set(
								"price_level",
								e.target.value ? Number(e.target.value) : undefined,
							)
						}
						className={inputClass}
					>
						<option value="">--</option>
						<option value="1">$ - Budget</option>
						<option value="2">$$ - Moderate</option>
						<option value="3">$$$ - Upscale</option>
						<option value="4">$$$$ - Premium</option>
					</select>
				</label>

				<label className={`sm:col-span-2 ${labelClass}`}>
					Tags (comma-separated)
					<input
						type="text"
						value={tagsInput}
						onChange={(e) => setTagsInput(e.target.value)}
						placeholder="vegan options, outdoor seating, family friendly"
						className={inputClass}
					/>
				</label>

				<label className={`sm:col-span-2 ${labelClass}`}>
					Description
					<textarea
						value={form.description ?? ""}
						onChange={(e) => set("description", e.target.value || undefined)}
						rows={3}
						className={inputClass}
					/>
				</label>

				<label className={`sm:col-span-2 ${labelClass}`}>
					Review
					<textarea
						value={form.review ?? ""}
						onChange={(e) => set("review", e.target.value || undefined)}
						rows={3}
						className={inputClass}
					/>
				</label>
			</div>

			{isError && (
				<p className="text-sm text-red-600">
					Something went wrong. Please try again.
				</p>
			)}

			<div className="flex justify-end gap-3">
				<button
					type="button"
					onClick={onCancel}
					className="cursor-pointer rounded-md border border-(--line) px-4 py-2 text-sm font-semibold text-(--sea-ink) hover:bg-(--surface)"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={isPending}
					className="cursor-pointer rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-(--lagoon) disabled:opacity-50"
				>
					{isPending ? "Saving..." : submitLabel}
				</button>
			</div>
		</form>
	);
}
