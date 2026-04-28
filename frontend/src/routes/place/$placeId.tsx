import { useAuth, useClerk } from "@clerk/clerk-react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PlaceCheckInButton } from "#/components/PlaceCheckInButton";
import { PlaceForm, placeToForm } from "#/components/PlaceForm";
import { PlaceMap } from "#/components/PlaceMap";
import { Spinner } from "#/components/Spinner";
import { SuggestPlaceDeleteModal } from "#/components/SuggestPlaceDeleteModal";
import { SuggestPlaceEditModal } from "#/components/SuggestPlaceEditModal";
import { formatCuisineLabel } from "#/lib/cuisines";
import { usePlaceCheckInCounts } from "#/lib/hooks/usePlaceCheckIns";
import {
	placeDetailOptions,
	useDeletePlace,
	usePlace,
	useUpdatePlace,
} from "#/lib/hooks/usePlaces";
import { useUserRole } from "#/lib/hooks/useUserRole";
import type { CreatePlaceInput, Place } from "#/lib/types";

export const Route = createFileRoute("/place/$placeId")({
	ssr: false,
	loader: async ({ context, params }) => {
		const place = await context.queryClient.ensureQueryData(
			placeDetailOptions(params.placeId),
		);
		return place;
	},
	head: ({ loaderData }) => {
		const place = loaderData as Place | undefined;
		if (!place) return {};
		const kindLabel = formatPlaceKindLabel(place);
		const parts = [place.Address, place.City, place.State].filter(Boolean);
		const description = parts.length
			? `${place.Name} — ${kindLabel} in ${parts.join(", ")}`
			: `${place.Name} — ${kindLabel}`;
		return {
			meta: [
				{ title: `${place.Name} | 919Events` },
				{ name: "description", content: description },
				{ property: "og:title", content: place.Name },
				{ property: "og:description", content: description },
			],
			links: [
				{ rel: "canonical", href: `https://919events.com/place/${place.ID}` },
			],
		};
	},
	component: PlaceDetailPage,
});

function formatPlaceKindLabel(place: Place): string {
	const parts: string[] = [];
	if (place.IsFood && place.Cuisine)
		parts.push(formatCuisineLabel(place.Cuisine));
	if (place.IsDrink && place.BarType) {
		parts.push(place.BarType === "brewery" ? "Brewery" : "Bar");
	}
	return parts.join(" · ");
}

function PlaceBadges({ place }: { place: Place }) {
	const badges: { key: string; label: string; cls: string }[] = [];
	if (place.IsFood && place.Cuisine) {
		badges.push({
			key: "cuisine",
			label: formatCuisineLabel(place.Cuisine),
			cls: "bg-orange-200 text-orange-900 dark:bg-orange-900/30 dark:text-orange-300",
		});
	}
	if (place.IsDrink && place.BarType) {
		badges.push({
			key: "bar_type",
			label: place.BarType === "brewery" ? "Brewery" : "Bar",
			cls:
				place.BarType === "brewery"
					? "bg-amber-200 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300"
					: "bg-purple-200 text-purple-900 dark:bg-purple-900/30 dark:text-purple-300",
		});
	}
	return (
		<>
			{badges.map((b) => (
				<span
					key={b.key}
					className={`rounded-full px-3 py-1 text-sm font-medium ${b.cls}`}
				>
					{b.label}
				</span>
			))}
		</>
	);
}

function CheckInCountsLabel({ placeId }: { placeId: string }) {
	const { data } = usePlaceCheckInCounts(placeId);
	if (!data || data.unique === 0) return null;
	return (
		<p className="text-sm text-(--sea-ink-soft)">
			{data.unique} visitor{data.unique === 1 ? "" : "s"} · {data.total}{" "}
			check-in{data.total === 1 ? "" : "s"}
		</p>
	);
}

function PlaceEditForm({
	place,
	onClose,
}: {
	place: Place;
	onClose: () => void;
}) {
	const updatePlace = useUpdatePlace();

	async function handleSubmit(data: CreatePlaceInput) {
		await updatePlace.mutateAsync({ id: place.ID, data });
		onClose();
	}

	return (
		<PlaceForm
			initial={placeToForm(place)}
			onSubmit={handleSubmit}
			onCancel={onClose}
			isPending={updatePlace.isPending}
			isError={updatePlace.isError}
			submitLabel="Save Changes"
		/>
	);
}

function PlaceDetailPage() {
	const { placeId } = Route.useParams();
	const { data: place, isLoading } = usePlace(placeId);
	const { isSignedIn } = useAuth();
	const { openSignIn } = useClerk();
	const { isAdmin } = useUserRole();
	const router = useRouter();
	const deletePlace = useDeletePlace();
	const [editing, setEditing] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [showSuggestEdit, setShowSuggestEdit] = useState(false);
	const [showSuggestDelete, setShowSuggestDelete] = useState(false);

	const handleDelete = async () => {
		if (!place) return;
		await deletePlace.mutateAsync(place.ID);
		router.history.back();
	};

	if (isLoading) return <Spinner className="py-24" />;

	if (!place) {
		return (
			<div className="mx-auto max-w-7xl px-4 py-12 text-center sm:px-6 lg:px-8">
				<p className="text-lg text-(--sea-ink-soft)">Place not found.</p>
				<Link
					to="/places"
					search={{ tab: "food" }}
					className="mt-4 inline-block text-(--lagoon-deep) hover:text-(--lagoon)"
				>
					&larr; Back
				</Link>
			</div>
		);
	}

	const backTab = place.IsFood ? "food" : "drinks";
	const addressParts = [
		place.Address,
		place.City,
		place.State,
		place.Zip,
	].filter(Boolean);

	return (
		<div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
			<Link
				to="/places"
				search={{ tab: backTab }}
				className="text-sm text-(--lagoon-deep) hover:text-(--lagoon)"
			>
				&larr; Back to Places
			</Link>

			{editing && place ? (
				<PlaceEditForm place={place} onClose={() => setEditing(false)} />
			) : (
				<>
					<div className="flex items-start justify-between">
						<div className="flex flex-col gap-2">
							<div className="flex flex-wrap items-start gap-3">
								<h1 className="text-2xl font-bold text-(--sea-ink)">
									{place.Name}
								</h1>
								<PlaceBadges place={place} />
								{place.PriceLevel && (
									<span className="rounded-full border border-(--line) px-3 py-1 text-sm font-medium text-(--sea-ink-soft)">
										{"$".repeat(place.PriceLevel)}
									</span>
								)}
							</div>
							<CheckInCountsLabel placeId={place.ID} />
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<PlaceCheckInButton placeId={place.ID} />
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
												disabled={deletePlace.isPending}
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

					{place.ImageUrl && (
						<img
							src={place.ImageUrl}
							alt={place.Name}
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
							{place.Phone && (
								<div>
									<h2 className="text-sm font-semibold uppercase tracking-wide text-(--sea-ink-soft)">
										Phone
									</h2>
									<a
										href={`tel:${place.Phone}`}
										className="mt-1 block text-(--lagoon-deep) hover:text-(--lagoon)"
									>
										{place.Phone}
									</a>
								</div>
							)}
							{place.Website && (
								<div>
									<h2 className="text-sm font-semibold uppercase tracking-wide text-(--sea-ink-soft)">
										Website
									</h2>
									<a
										href={
											place.Website.startsWith("http")
												? place.Website
												: `https://${place.Website}`
										}
										target="_blank"
										rel="noopener noreferrer"
										className="mt-1 block truncate text-(--lagoon-deep) hover:text-(--lagoon)"
									>
										{place.Website}
									</a>
								</div>
							)}
							{place.Hours && (
								<div>
									<h2 className="text-sm font-semibold uppercase tracking-wide text-(--sea-ink-soft)">
										Hours
									</h2>
									<p className="mt-1 whitespace-pre-line text-(--sea-ink)">
										{place.Hours}
									</p>
								</div>
							)}
						</div>

						<PlaceMap
							places={[place]}
							center={{ lat: place.Latitude, lng: place.Longitude }}
							radiusMiles={1}
							zoom={14}
							className="h-[300px] w-full rounded-lg"
						/>
					</div>

					{place.Tags && place.Tags.length > 0 && (
						<div className="flex flex-wrap gap-2">
							{place.Tags.map((tag) => (
								<span
									key={tag}
									className="rounded-full bg-[rgba(123,142,232,0.14)] px-3 py-1 text-sm font-medium text-(--lagoon-deep)"
								>
									{tag}
								</span>
							))}
						</div>
					)}

					{place.Description && (
						<div>
							<h2 className="text-sm font-semibold uppercase tracking-wide text-(--sea-ink-soft)">
								About
							</h2>
							<p className="mt-2 leading-relaxed text-(--sea-ink)">
								{place.Description}
							</p>
						</div>
					)}

					{place.Review && (
						<div className="rounded-lg border border-(--line) bg-(--surface) p-4">
							<h2 className="text-sm font-semibold uppercase tracking-wide text-(--sea-ink-soft)">
								Review
							</h2>
							<p className="mt-2 leading-relaxed text-(--sea-ink)">
								{place.Review}
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

			{showSuggestEdit && place && (
				<SuggestPlaceEditModal
					place={place}
					onClose={() => setShowSuggestEdit(false)}
				/>
			)}

			{showSuggestDelete && place && (
				<SuggestPlaceDeleteModal
					place={place}
					onClose={() => setShowSuggestDelete(false)}
				/>
			)}
		</div>
	);
}
