import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { LocationPickerMap } from "#/components/LocationPickerMap";
import { getSavedLocation } from "#/components/LocationSearch";
import { Spinner } from "#/components/Spinner";
import {
	useBeverages,
	useCreateBeverage,
	useDeleteBeverage,
	useUpdateBeverage,
} from "#/lib/hooks/useBeverages";
import type { Beverage, CreateBeverageInput } from "#/lib/types";

const WIDE_CENTER = { lat: 35.7796, lng: -78.6382 };
const WIDE_RADIUS = 500;

const inputClass =
	"mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm shadow-sm focus:border-[var(--lagoon)] focus:ring-[var(--lagoon)]";
const labelClass = "block text-sm font-medium text-[var(--sea-ink-soft)]";

function emptyForm(): CreateBeverageInput {
	const saved = getSavedLocation();
	return {
		name: "",
		type: "brewery",
		latitude: saved?.lat ?? 0,
		longitude: saved?.lng ?? 0,
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
				// Silently fail — user can still place the pin manually.
			}
		}, 800);
	};

	useEffect(() => () => clearTimeout(timerRef.current), []);

	return geocode;
}

function beverageToForm(b: Beverage): CreateBeverageInput {
	return {
		name: b.Name,
		type: b.Type,
		address: b.Address || undefined,
		city: b.City || undefined,
		state: b.State || undefined,
		zip: b.Zip || undefined,
		latitude: b.Latitude,
		longitude: b.Longitude,
		phone: b.Phone || undefined,
		website: b.Website || undefined,
		hours: b.Hours || undefined,
		description: b.Description || undefined,
		review: b.Review || undefined,
		image_url: b.ImageUrl || undefined,
		tags: b.Tags ?? [],
		price_level: b.PriceLevel ?? undefined,
	};
}

function BeverageForm({
	initial,
	onSubmit,
	onCancel,
	isPending,
	isError,
	submitLabel,
}: {
	initial: CreateBeverageInput;
	onSubmit: (data: CreateBeverageInput) => void;
	onCancel: () => void;
	isPending: boolean;
	isError: boolean;
	submitLabel: string;
}) {
	const [form, setForm] = useState(initial);
	const [tagsInput, setTagsInput] = useState((initial.tags ?? []).join(", "));

	function set<K extends keyof CreateBeverageInput>(
		key: K,
		value: CreateBeverageInput[K],
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
					Type *
					<select
						value={form.type}
						onChange={(e) => set("type", e.target.value as "brewery" | "bar")}
						className={inputClass}
					>
						<option value="brewery">Brewery</option>
						<option value="bar">Bar</option>
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
						placeholder="e.g. Mon-Sat 12pm-10pm, Sun 12pm-8pm"
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
						placeholder="pet-friendly, outdoor seating, food menu"
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

function BeverageRow({
	beverage,
	onEdit,
}: {
	beverage: Beverage;
	onEdit: (b: Beverage) => void;
}) {
	const deleteBeverage = useDeleteBeverage();
	const [confirming, setConfirming] = useState(false);

	return (
		<tr className="border-b border-(--line) last:border-0">
			<td className="px-4 py-2">
				<Link
					to="/beverages/$beverageId"
					params={{ beverageId: beverage.ID }}
					className="font-medium text-(--lagoon-deep) hover:text-(--lagoon)"
				>
					{beverage.Name}
				</Link>
			</td>
			<td className="px-4 py-2 text-(--sea-ink-soft)">
				<span
					className={`rounded-full px-2 py-0.5 text-xs font-medium ${
						beverage.Type === "brewery"
							? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
							: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
					}`}
				>
					{beverage.Type === "brewery" ? "Brewery" : "Bar"}
				</span>
			</td>
			<td className="hidden px-4 py-2 text-sm text-(--sea-ink-soft) sm:table-cell">
				{[beverage.City, beverage.State].filter(Boolean).join(", ")}
			</td>
			<td className="px-4 py-2 text-right">
				<div className="flex justify-end gap-2">
					<button
						type="button"
						onClick={() => onEdit(beverage)}
						className="cursor-pointer rounded-md border border-(--line) px-2.5 py-1 text-xs font-medium text-(--sea-ink) hover:bg-(--surface)"
					>
						Edit
					</button>
					{confirming ? (
						<button
							type="button"
							onClick={() => deleteBeverage.mutate(beverage.ID)}
							disabled={deleteBeverage.isPending}
							className="cursor-pointer rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
						>
							{deleteBeverage.isPending ? "..." : "Confirm"}
						</button>
					) : (
						<button
							type="button"
							onClick={() => setConfirming(true)}
							className="cursor-pointer rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
						>
							Delete
						</button>
					)}
				</div>
			</td>
		</tr>
	);
}

export function BeverageManager() {
	const { data, isLoading } = useBeverages({
		lat: WIDE_CENTER.lat,
		lng: WIDE_CENTER.lng,
		radius: WIDE_RADIUS,
	});
	const beverages = data?.beverages ?? [];

	const createBeverage = useCreateBeverage();
	const updateBeverage = useUpdateBeverage();

	const [mode, setMode] = useState<"list" | "create" | { editing: Beverage }>(
		"list",
	);

	function handleCreate(formData: CreateBeverageInput) {
		createBeverage.mutate(formData, {
			onSuccess: () => setMode("list"),
		});
	}

	function handleUpdate(formData: CreateBeverageInput) {
		if (typeof mode !== "object") return;
		updateBeverage.mutate(
			{ id: mode.editing.ID, data: formData },
			{ onSuccess: () => setMode("list") },
		);
	}

	return (
		<div>
			<div className="mb-4 flex items-center justify-between">
				<h2 className="text-xl font-bold text-(--sea-ink)">
					Manage Bars & Breweries
					{beverages.length > 0 && (
						<span className="ml-2 inline-flex items-center rounded-full bg-[rgba(79,184,178,0.14)] px-2.5 py-0.5 text-sm font-medium text-(--lagoon-deep)">
							{beverages.length}
						</span>
					)}
				</h2>
				{mode === "list" && (
					<button
						type="button"
						onClick={() => setMode("create")}
						className="cursor-pointer rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-semibold text-white hover:bg-(--lagoon)"
					>
						Add Bar/Brewery
					</button>
				)}
			</div>

			{mode === "create" && (
				<BeverageForm
					initial={emptyForm()}
					onSubmit={handleCreate}
					onCancel={() => setMode("list")}
					isPending={createBeverage.isPending}
					isError={createBeverage.isError}
					submitLabel="Create"
				/>
			)}

			{typeof mode === "object" && (
				<BeverageForm
					initial={beverageToForm(mode.editing)}
					onSubmit={handleUpdate}
					onCancel={() => setMode("list")}
					isPending={updateBeverage.isPending}
					isError={updateBeverage.isError}
					submitLabel="Save Changes"
				/>
			)}

			{mode === "list" &&
				(isLoading ? (
					<Spinner className="py-12" />
				) : beverages.length === 0 ? (
					<p className="py-8 text-center text-(--sea-ink-soft)">
						No beverages yet. Click "Add Beverage" to create one.
					</p>
				) : (
					<div className="overflow-hidden rounded-lg border border-(--line) bg-(--surface-strong)">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-(--line) text-left text-(--sea-ink-soft)">
									<th className="px-4 py-2 font-medium">Name</th>
									<th className="px-4 py-2 font-medium">Type</th>
									<th className="hidden px-4 py-2 font-medium sm:table-cell">
										Location
									</th>
									<th className="px-4 py-2 text-right font-medium">Actions</th>
								</tr>
							</thead>
							<tbody>
								{beverages.map((b) => (
									<BeverageRow
										key={b.ID}
										beverage={b}
										onEdit={(bev) => setMode({ editing: bev })}
									/>
								))}
							</tbody>
						</table>
					</div>
				))}
		</div>
	);
}
