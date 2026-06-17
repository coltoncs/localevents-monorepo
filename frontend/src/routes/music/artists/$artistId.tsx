import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { EventCard } from "#/components/events/EventCard";
import { AddShowForm } from "#/components/music/AddShowForm";
import { ArtistForm } from "#/components/music/ArtistForm";
import { Spinner } from "#/components/Spinner";
import {
	artistDetailOptions,
	useArtist,
	useArtistEvents,
	useDeleteArtist,
	useUpdateArtist,
} from "#/lib/hooks/useArtists";
import { useUser } from "#/lib/hooks/useUser";
import { useUserRole } from "#/lib/hooks/useUserRole";
import type { Artist, CreateArtistInput } from "#/lib/types";

export const Route = createFileRoute("/music/artists/$artistId")({
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(
			artistDetailOptions(params.artistId),
		);
	},
	head: ({ loaderData }) => {
		const artist = loaderData as Artist | undefined;
		if (!artist) return {};
		return {
			meta: [
				{ title: `${artist.Name} | 919Events` },
				{
					name: "description",
					content: artist.Bio || `Upcoming shows for ${artist.Name}.`,
				},
			],
		};
	},
	component: ArtistDetailPage,
});

const SOCIALS: { key: keyof Artist; label: string }[] = [
	{ key: "WebsiteUrl", label: "Website" },
	{ key: "SpotifyUrl", label: "Spotify" },
	{ key: "InstagramUrl", label: "Instagram" },
	{ key: "BandcampUrl", label: "Bandcamp" },
	{ key: "YoutubeUrl", label: "YouTube" },
];

function ArtistDetailPage() {
	const { artistId } = Route.useParams();
	const navigate = useNavigate();
	const { data: artist, isLoading } = useArtist(artistId);
	const { data: eventsData } = useArtistEvents(artistId);
	const { data: user } = useUser();
	const { isAdmin } = useUserRole();
	const update = useUpdateArtist();
	const deleteArtist = useDeleteArtist();
	const [editing, setEditing] = useState(false);
	const [addingShow, setAddingShow] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [editError, setEditError] = useState<string | null>(null);

	async function handleDelete() {
		try {
			await deleteArtist.mutateAsync(artistId);
			navigate({ to: "/music/artists" });
		} catch {
			setConfirmingDelete(false);
		}
	}

	const events = eventsData?.events ?? [];

	if (isLoading) return <Spinner className="py-24" />;
	if (!artist) {
		return (
			<div className="mx-auto max-w-2xl px-4 py-16 text-center text-(--sea-ink-soft)">
				Artist not found.
			</div>
		);
	}

	const canManage =
		isAdmin ||
		(!!user?.ID && !!artist.OwnerUserID && user.ID === artist.OwnerUserID);

	const hometown = [artist.HometownCity, artist.HometownState]
		.filter(Boolean)
		.join(", ");
	const genres = artist.Genres ?? [];

	async function handleEdit(data: CreateArtistInput) {
		setEditError(null);
		try {
			await update.mutateAsync({ id: artistId, data });
			setEditing(false);
		} catch (err) {
			setEditError(err instanceof Error ? err.message : "Failed to update.");
		}
	}

	return (
		<div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
			<Link
				to="/music/artists"
				className="text-sm text-(--lagoon-deep) hover:text-(--lagoon)"
			>
				&larr; Back to artists
			</Link>

			{editing ? (
				<ArtistForm
					initial={artist}
					onSubmit={handleEdit}
					submitting={update.isPending}
					error={editError}
					submitLabel="Save changes"
				/>
			) : (
				<div className="flex flex-col gap-4 sm:flex-row">
					{artist.ImageUrl && (
						<img
							src={artist.ImageUrl}
							alt={artist.Name}
							className="h-48 w-48 shrink-0 rounded-lg object-cover"
						/>
					)}
					<div className="flex-1">
						<div className="flex flex-wrap items-start justify-between gap-2">
							<h1 className="text-2xl font-bold text-(--sea-ink)">
								{artist.Name}
							</h1>
							{canManage && (
								<div className="flex flex-wrap gap-2">
									<button
										type="button"
										onClick={() => setEditing(true)}
										className="cursor-pointer rounded-md border border-(--line) px-3 py-1.5 text-sm font-medium text-(--sea-ink) hover:bg-(--surface)"
									>
										Edit
									</button>
									<button
										type="button"
										onClick={() => setAddingShow((v) => !v)}
										className="cursor-pointer rounded-md bg-(--lagoon-deep) px-3 py-1.5 text-sm font-medium text-(--foam) hover:opacity-90"
									>
										Add a show
									</button>
									{confirmingDelete ? (
										<>
											<button
												type="button"
												onClick={handleDelete}
												disabled={deleteArtist.isPending}
												className="cursor-pointer rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
											>
												{deleteArtist.isPending
													? "Deleting..."
													: "Confirm delete"}
											</button>
											<button
												type="button"
												onClick={() => setConfirmingDelete(false)}
												disabled={deleteArtist.isPending}
												className="cursor-pointer rounded-md border border-(--line) px-3 py-1.5 text-sm font-medium text-(--sea-ink) hover:bg-(--surface)"
											>
												Cancel
											</button>
										</>
									) : (
										<button
											type="button"
											onClick={() => setConfirmingDelete(true)}
											className="cursor-pointer rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
										>
											Delete
										</button>
									)}
								</div>
							)}
						</div>
						{hometown && (
							<p className="mt-1 text-sm text-(--sea-ink-soft)">{hometown}</p>
						)}
						{genres.length > 0 && (
							<div className="mt-2 flex flex-wrap gap-1.5">
								{genres.map((g) => (
									<span
										key={g}
										className="rounded-full border border-(--line) px-2 py-0.5 text-xs text-(--sea-ink-soft)"
									>
										{g}
									</span>
								))}
							</div>
						)}
						{artist.Bio && (
							<p className="mt-3 whitespace-pre-line text-sm text-(--sea-ink)">
								{artist.Bio}
							</p>
						)}
						<div className="mt-3 flex flex-wrap gap-3">
							{SOCIALS.map(({ key, label }) => {
								const url = artist[key] as string | undefined;
								if (!url) return null;
								return (
									<a
										key={key}
										href={url}
										target="_blank"
										rel="noopener noreferrer"
										className="text-sm font-medium text-(--lagoon-deep) hover:underline"
									>
										{label}
									</a>
								);
							})}
						</div>
					</div>
				</div>
			)}

			{addingShow && canManage && (
				<AddShowForm artistId={artistId} onDone={() => setAddingShow(false)} />
			)}

			<div>
				<h2 className="mb-3 text-xl font-bold text-(--sea-ink)">
					Upcoming shows
				</h2>
				{events.length === 0 ? (
					<p className="py-8 text-center text-(--sea-ink-soft)">
						No upcoming shows listed.
					</p>
				) : (
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{events.map((event) => (
							<EventCard key={event.ID} event={event} />
						))}
					</div>
				)}
			</div>
		</div>
	);
}
