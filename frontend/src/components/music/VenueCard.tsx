import { Link } from "@tanstack/react-router";
import type { Venue } from "#/lib/types";

export function VenueCard({ venue }: { venue: Venue }) {
	const location = [venue.City, venue.State].filter(Boolean).join(", ");
	const genres = venue.Genres ?? [];

	return (
		<Link
			to="/venues/$venueId"
			params={{ venueId: venue.ID }}
			className="block rounded-lg border border-(--line) bg-(--surface-strong) p-4 shadow-sm transition hover:shadow-md"
		>
			<div className="flex items-start justify-between gap-2">
				<h3 className="font-semibold text-(--sea-ink)">{venue.VenueName}</h3>
				{venue.IsClaimed && (
					<span className="shrink-0 rounded-full bg-[rgba(79,184,178,0.14)] px-2 py-0.5 text-xs font-medium text-(--lagoon-deep)">
						Claimed
					</span>
				)}
			</div>

			{location && (
				<p className="mt-1 text-sm text-(--sea-ink-soft)">{location}</p>
			)}
			{venue.Address && (
				<p className="text-sm text-(--sea-ink-soft)">{venue.Address}</p>
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

			{venue.AcceptsBookingRequests && (
				<p className="mt-3 text-xs font-medium text-(--lagoon-deep)">
					Accepting booking requests
				</p>
			)}
		</Link>
	);
}
