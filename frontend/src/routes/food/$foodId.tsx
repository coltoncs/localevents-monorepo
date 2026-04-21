import { useAuth, useClerk } from "@clerk/clerk-react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { formatCuisineLabel } from "#/components/FoodCard";
import { FoodCheckInButton } from "#/components/FoodCheckInButton";
import { FoodMap } from "#/components/FoodMap";
import { ImageUpload } from "#/components/ImageUpload";
import { Spinner } from "#/components/Spinner";
import { SuggestFoodDeleteModal } from "#/components/SuggestFoodDeleteModal";
import { SuggestFoodEditModal } from "#/components/SuggestFoodEditModal";
import { CUISINES } from "#/lib/cuisines";
import { useFoodCheckInCounts } from "#/lib/hooks/useFoodCheckIns";
import {
	foodDetailOptions,
	useDeleteFood,
	useFood,
	useUpdateFood,
} from "#/lib/hooks/useFoods";
import { useUserRole } from "#/lib/hooks/useUserRole";
import type { CreateFoodInput, Cuisine, Food } from "#/lib/types";

export const Route = createFileRoute("/food/$foodId")({
	ssr: false,
	loader: async ({ context, params }) => {
		const food = await context.queryClient.ensureQueryData(
			foodDetailOptions(params.foodId),
		);
		return food;
	},
	head: ({ loaderData }) => {
		const food = loaderData as Food | undefined;
		if (!food) return {};
		const cuisineLabel = formatCuisineLabel(food.Cuisine);
		const parts = [food.Address, food.City, food.State].filter(Boolean);
		const description = parts.length
			? `${food.Name} — ${cuisineLabel} in ${parts.join(", ")}`
			: `${food.Name} — ${cuisineLabel}`;
		return {
			meta: [
				{ title: `${food.Name} | 919Events` },
				{ name: "description", content: description },
				{ property: "og:title", content: food.Name },
				{ property: "og:description", content: description },
			],
			links: [
				{ rel: "canonical", href: `https://919events.com/food/${food.ID}` },
			],
		};
	},
	component: FoodDetailPage,
});

const editInputClass =
	"mt-1 block w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm shadow-sm focus:border-[var(--lagoon)] focus:ring-[var(--lagoon)]";
const editLabelClass = "block text-sm font-medium text-[var(--sea-ink-soft)]";

function FoodEditForm({ food, onClose }: { food: Food; onClose: () => void }) {
	const updateFood = useUpdateFood();
	const [name, setName] = useState(food.Name);
	const [cuisine, setCuisine] = useState<Cuisine>(food.Cuisine);
	const [address, setAddress] = useState(food.Address || "");
	const [city, setCity] = useState(food.City || "");
	const [state, setState] = useState(food.State || "");
	const [zip, setZip] = useState(food.Zip || "");
	const [phone, setPhone] = useState(food.Phone ?? "");
	const [website, setWebsite] = useState(food.Website ?? "");
	const [hours, setHours] = useState(food.Hours || "");
	const [description, setDescription] = useState(food.Description || "");
	const [review, setReview] = useState(food.Review || "");
	const [imageUrl, setImageUrl] = useState(food.ImageUrl || "");
	const [tagsInput, setTagsInput] = useState((food.Tags ?? []).join(", "));
	const [priceLevel, setPriceLevel] = useState<number | undefined>(
		food.PriceLevel ?? undefined,
	);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const tags = tagsInput
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean);
		const data: CreateFoodInput = {
			name,
			cuisine,
			address: address || undefined,
			city: city || undefined,
			state: state || undefined,
			zip: zip || undefined,
			latitude: food.Latitude,
			longitude: food.Longitude,
			phone: phone || undefined,
			website: website || undefined,
			hours: hours || undefined,
			description: description || undefined,
			review: review || undefined,
			image_url: imageUrl || undefined,
			tags: tags.length > 0 ? tags : undefined,
			price_level: priceLevel,
		};
		await updateFood.mutateAsync({ id: food.ID, data });
		onClose();
	}

	return (
		<form
			onSubmit={handleSubmit}
			className="rounded-lg border border-(--line) bg-(--surface-strong) p-4 space-y-4"
		>
			<h2 className="text-lg font-semibold text-(--sea-ink)">
				Edit Restaurant
			</h2>
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
					Cuisine *
					<select
						value={cuisine}
						onChange={(e) => setCuisine(e.target.value as Cuisine)}
						className={editInputClass}
					>
						{CUISINES.map((c) => (
							<option key={c.value} value={c.value}>
								{c.label}
							</option>
						))}
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
						placeholder="e.g. Mon-Sat 11am-10pm, Sun 11am-8pm"
						className={editInputClass}
					/>
				</label>
				<div className="sm:col-span-2">
					<ImageUpload value={imageUrl} onChange={setImageUrl} label="Image" />
				</div>
				<label className={editLabelClass}>
					Tags (comma-separated)
					<input
						type="text"
						value={tagsInput}
						onChange={(e) => setTagsInput(e.target.value)}
						placeholder="vegan options, outdoor seating, family friendly"
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
			{updateFood.isError && (
				<p className="text-sm text-red-600">
					Failed to update food. Please try again.
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
					disabled={updateFood.isPending}
					className="cursor-pointer rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-(--lagoon) disabled:opacity-50"
				>
					{updateFood.isPending ? "Saving..." : "Save"}
				</button>
			</div>
		</form>
	);
}

function CheckInCountsLabel({ foodId }: { foodId: string }) {
	const { data } = useFoodCheckInCounts(foodId);
	if (!data || data.unique === 0) return null;
	return (
		<p className="text-sm text-(--sea-ink-soft)">
			{data.unique} visitor{data.unique === 1 ? "" : "s"} · {data.total}{" "}
			check-in{data.total === 1 ? "" : "s"}
		</p>
	);
}

function FoodDetailPage() {
	const { foodId } = Route.useParams();
	const { data: food, isLoading } = useFood(foodId);
	const { isSignedIn } = useAuth();
	const { openSignIn } = useClerk();
	const { isAdmin } = useUserRole();
	const router = useRouter();
	const deleteFood = useDeleteFood();
	const [editing, setEditing] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [showSuggestEdit, setShowSuggestEdit] = useState(false);
	const [showSuggestDelete, setShowSuggestDelete] = useState(false);

	const handleDelete = async () => {
		if (!food) return;
		await deleteFood.mutateAsync(food.ID);
		router.history.back();
	};

	if (isLoading) return <Spinner className="py-24" />;

	if (!food) {
		return (
			<div className="mx-auto max-w-7xl px-4 py-12 text-center sm:px-6 lg:px-8">
				<p className="text-lg text-(--sea-ink-soft)">Restaurant not found.</p>
				<Link
					to="/places"
					search={{ tab: "food" }}
					className="mt-4 inline-block text-(--lagoon-deep) hover:text-(--lagoon)"
				>
					&larr; Back to Restaurants
				</Link>
			</div>
		);
	}

	const cuisineLabel = formatCuisineLabel(food.Cuisine);
	const addressParts = [food.Address, food.City, food.State, food.Zip].filter(
		Boolean,
	);

	return (
		<div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
			<Link
				to="/places"
				search={{ tab: "food" }}
				className="text-sm text-(--lagoon-deep) hover:text-(--lagoon)"
			>
				&larr; Back to Restaurants
			</Link>

			{editing && food ? (
				<FoodEditForm food={food} onClose={() => setEditing(false)} />
			) : (
				<>
					<div className="flex items-start justify-between">
						<div className="flex flex-col gap-2">
							<div className="flex flex-wrap items-start gap-3">
								<h1 className="text-2xl font-bold text-(--sea-ink)">
									{food.Name}
								</h1>
								<span className="rounded-full bg-orange-200 px-3 py-1 text-sm font-medium text-orange-900 dark:bg-orange-900/30 dark:text-orange-300">
									{cuisineLabel}
								</span>
								{food.PriceLevel && (
									<span className="rounded-full border border-(--line) px-3 py-1 text-sm font-medium text-(--sea-ink-soft)">
										{"$".repeat(food.PriceLevel)}
									</span>
								)}
							</div>
							<CheckInCountsLabel foodId={food.ID} />
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<FoodCheckInButton foodId={food.ID} />
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
												disabled={deleteFood.isPending}
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

					{food.ImageUrl && (
						<img
							src={food.ImageUrl}
							alt={food.Name}
							className="h-64 w-full rounded-lg object-cover sm:h-80"
						/>
					)}

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

							{food.Phone && (
								<div>
									<h2 className="text-sm font-semibold uppercase tracking-wide text-(--sea-ink-soft)">
										Phone
									</h2>
									<a
										href={`tel:${food.Phone}`}
										className="mt-1 block text-(--lagoon-deep) hover:text-(--lagoon)"
									>
										{food.Phone}
									</a>
								</div>
							)}

							{food.Website && (
								<div>
									<h2 className="text-sm font-semibold uppercase tracking-wide text-(--sea-ink-soft)">
										Website
									</h2>
									<a
										href={
											food.Website.startsWith("http")
												? food.Website
												: `https://${food.Website}`
										}
										target="_blank"
										rel="noopener noreferrer"
										className="mt-1 block truncate text-(--lagoon-deep) hover:text-(--lagoon)"
									>
										{food.Website}
									</a>
								</div>
							)}

							{food.Hours && (
								<div>
									<h2 className="text-sm font-semibold uppercase tracking-wide text-(--sea-ink-soft)">
										Hours
									</h2>
									<p className="mt-1 whitespace-pre-line text-(--sea-ink)">
										{food.Hours}
									</p>
								</div>
							)}
						</div>

						<FoodMap
							foods={[food]}
							center={{ lat: food.Latitude, lng: food.Longitude }}
							radiusMiles={1}
							zoom={14}
							className="h-[300px] w-full rounded-lg"
						/>
					</div>

					{food.Tags && food.Tags.length > 0 && (
						<div className="flex flex-wrap gap-2">
							{food.Tags.map((tag) => (
								<span
									key={tag}
									className="rounded-full bg-[rgba(123,142,232,0.14)] px-3 py-1 text-sm font-medium text-(--lagoon-deep)"
								>
									{tag}
								</span>
							))}
						</div>
					)}

					{food.Description && (
						<div>
							<h2 className="text-sm font-semibold uppercase tracking-wide text-(--sea-ink-soft)">
								About
							</h2>
							<p className="mt-2 leading-relaxed text-(--sea-ink)">
								{food.Description}
							</p>
						</div>
					)}

					{food.Review && (
						<div className="rounded-lg border border-(--line) bg-(--surface) p-4">
							<h2 className="text-sm font-semibold uppercase tracking-wide text-(--sea-ink-soft)">
								Review
							</h2>
							<p className="mt-2 leading-relaxed text-(--sea-ink)">
								{food.Review}
							</p>
						</div>
					)}

					{!isAdmin && (
						<div className="flex justify-center border-t border-(--line) pt-6">
							<button
								type="button"
								onClick={() =>
									isSignedIn ? setShowSuggestDelete(true) : openSignIn()
								}
								className="cursor-pointer text-sm font-medium text-(--sea-ink-soft) hover:text-red-600 hover:underline"
							>
								Report as closed
							</button>
						</div>
					)}
				</>
			)}

			{showSuggestEdit && food && (
				<SuggestFoodEditModal
					food={food}
					onClose={() => setShowSuggestEdit(false)}
				/>
			)}

			{showSuggestDelete && food && (
				<SuggestFoodDeleteModal
					food={food}
					onClose={() => setShowSuggestDelete(false)}
				/>
			)}
		</div>
	);
}
