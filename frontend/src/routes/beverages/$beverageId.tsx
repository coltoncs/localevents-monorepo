import { useAuth, useClerk } from "@clerk/clerk-react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { BeverageMap } from "#/components/BeverageMap";
import { Spinner } from "#/components/Spinner";
import { SuggestBeverageEditModal } from "#/components/SuggestBeverageEditModal";
import {
	beverageDetailOptions,
	useBeverage,
	useDeleteBeverage,
	useUpdateBeverage,
} from "#/lib/hooks/useBeverages";
import { useUserRole } from "#/lib/hooks/useUserRole";
import type { Beverage, CreateBeverageInput } from "#/lib/types";

export const Route = createFileRoute("/beverages/$beverageId")({
	ssr: false,
	loader: async ({ context, params }) => {
		const beverage = await context.queryClient.ensureQueryData(
			beverageDetailOptions(params.beverageId),
		);
		return beverage;
	},
	head: ({ loaderData }) => {
		const bev = loaderData as Beverage | undefined;
		if (!bev) return {};
		const typeLabel = bev.Type === "brewery" ? "Brewery" : "Bar";
		const parts = [bev.Address, bev.City, bev.State].filter(Boolean);
		const description = parts.length
			? `${bev.Name} — ${typeLabel} in ${parts.join(", ")}`
			: `${bev.Name} — ${typeLabel}`;
		return {
			meta: [
				{ title: `${bev.Name} | 919Events` },
				{ name: "description", content: description },
				{ property: "og:title", content: bev.Name },
				{ property: "og:description", content: description },
			],
			links: [
				{ rel: "canonical", href: `https://919events.com/beverages/${bev.ID}` },
			],
		};
	},
	component: BeverageDetailPage,
});

const editInputClass =
	"mt-1 block w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm shadow-sm focus:border-[var(--lagoon)] focus:ring-[var(--lagoon)]";
const editLabelClass = "block text-sm font-medium text-[var(--sea-ink-soft)]";

function BeverageEditForm({
	beverage,
	onClose,
}: {
	beverage: Beverage;
	onClose: () => void;
}) {
	const updateBeverage = useUpdateBeverage();
	const [name, setName] = useState(beverage.Name);
	const [type, setType] = useState<"brewery" | "bar">(beverage.Type);
	const [address, setAddress] = useState(beverage.Address || "");
	const [city, setCity] = useState(beverage.City || "");
	const [state, setState] = useState(beverage.State || "");
	const [zip, setZip] = useState(beverage.Zip || "");
	const [phone, setPhone] = useState(beverage.Phone ?? "");
	const [website, setWebsite] = useState(beverage.Website ?? "");
	const [hours, setHours] = useState(beverage.Hours || "");
	const [description, setDescription] = useState(beverage.Description || "");
	const [review, setReview] = useState(beverage.Review || "");
	const [imageUrl, setImageUrl] = useState(beverage.ImageUrl || "");
	const [tagsInput, setTagsInput] = useState((beverage.Tags ?? []).join(", "));
	const [priceLevel, setPriceLevel] = useState<number | undefined>(
		beverage.PriceLevel ?? undefined,
	);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const tags = tagsInput
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean);
		const data: CreateBeverageInput = {
			name,
			type,
			address: address || undefined,
			city: city || undefined,
			state: state || undefined,
			zip: zip || undefined,
			latitude: beverage.Latitude,
			longitude: beverage.Longitude,
			phone: phone || undefined,
			website: website || undefined,
			hours: hours || undefined,
			description: description || undefined,
			review: review || undefined,
			image_url: imageUrl || undefined,
			tags: tags.length > 0 ? tags : undefined,
			price_level: priceLevel,
		};
		await updateBeverage.mutateAsync({ id: beverage.ID, data });
		onClose();
	}

	return (
		<form
			onSubmit={handleSubmit}
			className="rounded-lg border border-(--line) bg-(--surface-strong) p-4 space-y-4"
		>
			<h2 className="text-lg font-semibold text-(--sea-ink)">Edit Beverage</h2>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<label className={`sm:col-span-2 ${editLabelClass}`}>
					Name *
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						required
						className={editInputClass}
					/>
				</label>
				<label className={editLabelClass}>
					Type *
					<select
						value={type}
						onChange={(e) => setType(e.target.value as "brewery" | "bar")}
						className={editInputClass}
					>
						<option value="brewery">Brewery</option>
						<option value="bar">Bar</option>
					</select>
				</label>
				<label className={editLabelClass}>
					Price Level
					<select
						value={priceLevel ?? ""}
						onChange={(e) =>
							setPriceLevel(e.target.value ? Number(e.target.value) : undefined)
						}
						className={editInputClass}
					>
						<option value="">--</option>
						<option value="1">$ - Budget</option>
						<option value="2">$$ - Moderate</option>
						<option value="3">$$$ - Upscale</option>
						<option value="4">$$$$ - Premium</option>
					</select>
				</label>
				<label className={`sm:col-span-2 ${editLabelClass}`}>
					Address
					<input
						type="text"
						value={address}
						onChange={(e) => setAddress(e.target.value)}
						className={editInputClass}
					/>
				</label>
				<label className={editLabelClass}>
					City
					<input
						type="text"
						value={city}
						onChange={(e) => setCity(e.target.value)}
						className={editInputClass}
					/>
				</label>
				<div className="flex gap-4">
					<label className={`flex-1 ${editLabelClass}`}>
						State
						<select
							value={state}
							onChange={(e) => setState(e.target.value)}
							className={editInputClass}
						>
							<option value="">--</option>
							<option value="NC">NC</option>
							<option value="SC">SC</option>
							<option value="VA">VA</option>
						</select>
					</label>
					<label className={`w-28 ${editLabelClass}`}>
						ZIP
						<input
							type="text"
							value={zip}
							onChange={(e) => setZip(e.target.value)}
							className={editInputClass}
						/>
					</label>
				</div>
				<label className={editLabelClass}>
					Phone
					<input
						type="text"
						value={phone}
						onChange={(e) => setPhone(e.target.value)}
						placeholder="(919) 555-1234"
						className={editInputClass}
					/>
				</label>
				<label className={editLabelClass}>
					Website
					<input
						type="text"
						value={website}
						onChange={(e) => setWebsite(e.target.value)}
						placeholder="https://..."
						className={editInputClass}
					/>
				</label>
				<label className={`sm:col-span-2 ${editLabelClass}`}>
					Hours
					<input
						type="text"
						value={hours}
						onChange={(e) => setHours(e.target.value)}
						placeholder="e.g. Mon-Sat 12pm-10pm, Sun 12pm-8pm"
						className={editInputClass}
					/>
				</label>
				<label className={editLabelClass}>
					Image URL
					<input
						type="text"
						value={imageUrl}
						onChange={(e) => setImageUrl(e.target.value)}
						className={editInputClass}
					/>
				</label>
				<label className={editLabelClass}>
					Tags (comma-separated)
					<input
						type="text"
						value={tagsInput}
						onChange={(e) => setTagsInput(e.target.value)}
						placeholder="pet-friendly, outdoor seating, food menu"
						className={editInputClass}
					/>
				</label>
				<label className={`sm:col-span-2 ${editLabelClass}`}>
					Description
					<textarea
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						rows={3}
						className={editInputClass}
					/>
				</label>
				<label className={`sm:col-span-2 ${editLabelClass}`}>
					Review
					<textarea
						value={review}
						onChange={(e) => setReview(e.target.value)}
						rows={3}
						className={editInputClass}
					/>
				</label>
			</div>
			{updateBeverage.isError && (
				<p className="text-sm text-red-600">
					Failed to update beverage. Please try again.
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
					disabled={updateBeverage.isPending}
					className="cursor-pointer rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-(--lagoon) disabled:opacity-50"
				>
					{updateBeverage.isPending ? "Saving..." : "Save"}
				</button>
			</div>
		</form>
	);
}

function BeverageDetailPage() {
	const { beverageId } = Route.useParams();
	const { data: bev, isLoading } = useBeverage(beverageId);
	const { isSignedIn } = useAuth();
	const { openSignIn } = useClerk();
	const { isAdmin } = useUserRole();
	const router = useRouter();
	const deleteBeverage = useDeleteBeverage();
	const [editing, setEditing] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [showSuggestEdit, setShowSuggestEdit] = useState(false);

	const handleDelete = async () => {
		if (!bev) return;
		await deleteBeverage.mutateAsync(bev.ID);
		router.history.back();
	};

	if (isLoading) return <Spinner className="py-24" />;

	if (!bev) {
		return (
			<div className="mx-auto max-w-7xl px-4 py-12 text-center sm:px-6 lg:px-8">
				<p className="text-lg text-(--sea-ink-soft)">Beverage not found.</p>
				<Link
					to="/beverages"
					className="mt-4 inline-block text-(--lagoon-deep) hover:text-(--lagoon)"
				>
					&larr; Back to Breweries & Bars
				</Link>
			</div>
		);
	}

	const typeLabel = bev.Type === "brewery" ? "Brewery" : "Bar";
	const typeColor =
		bev.Type === "brewery"
			? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
			: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";

	const addressParts = [bev.Address, bev.City, bev.State, bev.Zip].filter(
		Boolean,
	);

	return (
		<div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
			<Link
				to="/beverages"
				className="text-sm text-(--lagoon-deep) hover:text-(--lagoon)"
			>
				&larr; Back to Breweries & Bars
			</Link>

			{editing && bev ? (
				<BeverageEditForm beverage={bev} onClose={() => setEditing(false)} />
			) : (
				<>
					{/* Header */}
					<div className="flex items-start justify-between">
						<div className="flex flex-wrap items-start gap-3">
							<h1 className="text-2xl font-bold text-(--sea-ink)">
								{bev.Name}
							</h1>
							<span
								className={`rounded-full px-3 py-1 text-sm font-medium ${typeColor}`}
							>
								{typeLabel}
							</span>
							{bev.PriceLevel && (
								<span className="rounded-full border border-(--line) px-3 py-1 text-sm font-medium text-(--sea-ink-soft)">
									{"$".repeat(bev.PriceLevel)}
								</span>
							)}
						</div>
						<div className="flex flex-wrap items-center gap-2">
							{!isAdmin && (
								<button
									type="button"
									onClick={() =>
										isSignedIn ? setShowSuggestEdit(true) : openSignIn()
									}
									className="text-nowrap cursor-pointer rounded-md border border-(--line) bg-(--surface-strong) px-3 py-1.5 text-sm font-medium text-(--sea-ink) hover:bg-(--surface)"
								>
									Suggest Edit
								</button>
							)}
							{isAdmin && (
								<>
									<button
										type="button"
										onClick={() => setEditing(true)}
										className="text-nowrap cursor-pointer rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
									>
										Edit
									</button>
									{!showDeleteConfirm ? (
										<button
											type="button"
											onClick={() => setShowDeleteConfirm(true)}
											className="text-nowrap cursor-pointer rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
										>
											Delete
										</button>
									) : (
										<div className="flex items-center gap-1">
											<button
												type="button"
												onClick={handleDelete}
												disabled={deleteBeverage.isPending}
												className="text-nowrap cursor-pointer rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
											>
												Confirm
											</button>
											<button
												type="button"
												onClick={() => setShowDeleteConfirm(false)}
												className="text-nowrap cursor-pointer rounded-md border border-(--line) px-3 py-1.5 text-sm font-medium text-(--sea-ink) hover:bg-(--surface)"
											>
												Cancel
											</button>
										</div>
									)}
								</>
							)}
						</div>
					</div>

					{/* Image */}
					{bev.ImageUrl && (
						<img
							src={bev.ImageUrl}
							alt={bev.Name}
							className="h-64 w-full rounded-lg object-cover sm:h-80"
						/>
					)}

					{/* Info grid */}
					<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
						<div className="space-y-4">
							{addressParts.length > 0 && (
								<div>
									<h2 className="text-sm font-semibold uppercase tracking-wide text-(--sea-ink-soft)">
										Address
									</h2>
									<p className="mt-1 text-(--sea-ink)">
										{addressParts.join(", ")}
									</p>
								</div>
							)}

							{bev.Phone && (
								<div>
									<h2 className="text-sm font-semibold uppercase tracking-wide text-(--sea-ink-soft)">
										Phone
									</h2>
									<a
										href={`tel:${bev.Phone}`}
										className="mt-1 block text-(--lagoon-deep) hover:text-(--lagoon)"
									>
										{bev.Phone}
									</a>
								</div>
							)}

							{bev.Website && (
								<div>
									<h2 className="text-sm font-semibold uppercase tracking-wide text-(--sea-ink-soft)">
										Website
									</h2>
									<a
										href={
											bev.Website.startsWith("http")
												? bev.Website
												: `https://${bev.Website}`
										}
										target="_blank"
										rel="noopener noreferrer"
										className="mt-1 block truncate text-(--lagoon-deep) hover:text-(--lagoon)"
									>
										{bev.Website}
									</a>
								</div>
							)}

							{bev.Hours && (
								<div>
									<h2 className="text-sm font-semibold uppercase tracking-wide text-(--sea-ink-soft)">
										Hours
									</h2>
									<p className="mt-1 whitespace-pre-line text-(--sea-ink)">
										{bev.Hours}
									</p>
								</div>
							)}
						</div>

						{/* Map */}
						<BeverageMap
							beverages={[bev]}
							center={{ lat: bev.Latitude, lng: bev.Longitude }}
							radiusMiles={1}
							zoom={14}
							className="h-[300px] w-full rounded-lg"
						/>
					</div>

					{/* Tags */}
					{bev.Tags && bev.Tags.length > 0 && (
						<div className="flex flex-wrap gap-2">
							{bev.Tags.map((tag) => (
								<span
									key={tag}
									className="rounded-full bg-[rgba(123,142,232,0.14)] px-3 py-1 text-sm font-medium text-(--lagoon-deep)"
								>
									{tag}
								</span>
							))}
						</div>
					)}

					{/* Description */}
					{bev.Description && (
						<div>
							<h2 className="text-sm font-semibold uppercase tracking-wide text-(--sea-ink-soft)">
								About
							</h2>
							<p className="mt-2 leading-relaxed text-(--sea-ink)">
								{bev.Description}
							</p>
						</div>
					)}

					{/* Review */}
					{bev.Review && (
						<div className="rounded-lg border border-(--line) bg-(--surface) p-4">
							<h2 className="text-sm font-semibold uppercase tracking-wide text-(--sea-ink-soft)">
								Review
							</h2>
							<p className="mt-2 leading-relaxed text-(--sea-ink)">
								{bev.Review}
							</p>
						</div>
					)}
				</>
			)}

			{showSuggestEdit && bev && (
				<SuggestBeverageEditModal
					beverage={bev}
					onClose={() => setShowSuggestEdit(false)}
				/>
			)}
		</div>
	);
}
