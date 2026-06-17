import { useAuth } from "@clerk/clerk-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArtistForm } from "#/components/music/ArtistForm";
import { Spinner } from "#/components/Spinner";
import { useCreateArtist } from "#/lib/hooks/useArtists";
import type { CreateArtistInput } from "#/lib/types";

export const Route = createFileRoute("/music/artists/new")({
	head: () => ({
		meta: [{ title: "Add Your Artist Profile | 919Events" }],
	}),
	component: NewArtistPage,
});

function NewArtistPage() {
	const { isSignedIn, isLoaded } = useAuth();
	const navigate = useNavigate();
	const create = useCreateArtist();
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(data: CreateArtistInput) {
		setError(null);
		try {
			const artist = await create.mutateAsync(data);
			navigate({
				to: "/music/artists/$artistId",
				params: { artistId: artist.ID },
			});
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to create profile.",
			);
		}
	}

	if (!isLoaded) return <Spinner className="py-24" />;

	if (!isSignedIn) {
		return (
			<div className="mx-auto max-w-xl px-4 py-16 text-center">
				<h1 className="text-2xl font-bold text-(--sea-ink)">
					Add your artist profile
				</h1>
				<p className="mt-2 text-(--sea-ink-soft)">
					Please sign in to create an artist profile.
				</p>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
			<div>
				<h1 className="text-2xl font-bold text-(--sea-ink)">
					Add your artist profile
				</h1>
				<p className="mt-1 text-(--sea-ink-soft)">
					Create a profile so fans and venues can find you — then list your own
					shows.
				</p>
			</div>
			<ArtistForm
				onSubmit={handleSubmit}
				submitting={create.isPending}
				error={error}
				submitLabel="Create profile"
			/>
		</div>
	);
}
