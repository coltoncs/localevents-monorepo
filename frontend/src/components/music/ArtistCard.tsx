import { Link } from "@tanstack/react-router";
import type { Artist } from "#/lib/types";

export function ArtistCard({ artist }: { artist: Artist }) {
	const hometown = [artist.HometownCity, artist.HometownState]
		.filter(Boolean)
		.join(", ");
	const genres = artist.Genres ?? [];

	return (
		<Link
			to="/music/artists/$artistId"
			params={{ artistId: artist.ID }}
			className="block overflow-hidden rounded-lg border border-(--line) bg-(--surface-strong) shadow-sm transition hover:shadow-md"
		>
			{artist.ImageUrl && (
				<img
					src={artist.ImageUrl}
					alt={artist.Name}
					loading="lazy"
					decoding="async"
					className="h-40 w-full object-cover"
				/>
			)}
			<div className="p-4">
				<div className="flex items-start justify-between gap-2">
					<h3 className="font-semibold text-(--sea-ink)">{artist.Name}</h3>
					{artist.IsClaimed && (
						<span className="shrink-0 rounded-full bg-[rgba(79,184,178,0.14)] px-2 py-0.5 text-xs font-medium text-(--lagoon-deep)">
							Verified
						</span>
					)}
				</div>
				{hometown && (
					<p className="mt-1 text-sm text-(--sea-ink-soft)">{hometown}</p>
				)}
				{genres.length > 0 && (
					<div className="mt-3 flex flex-wrap gap-1.5">
						{genres.slice(0, 4).map((g) => (
							<span
								key={g}
								className="rounded-full border border-(--line) px-2 py-0.5 text-xs text-(--sea-ink-soft)"
							>
								{g}
							</span>
						))}
					</div>
				)}
			</div>
		</Link>
	);
}
