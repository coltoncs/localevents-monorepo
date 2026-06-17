import { useState } from "react";
import { MUSIC_GENRES } from "#/components/music/ConcertFilters";
import { useCreateArtistShow } from "#/lib/hooks/useArtists";

const inputCls =
	"mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)";
const labelCls = "block text-sm font-medium text-(--sea-ink-soft)";

// Best-effort geocode so the show appears in location-based listings.
async function geocode(
	address: string,
	city: string,
	state: string,
	zip: string,
): Promise<{ lat: number; lng: number } | null> {
	const query = `${address}, ${city}, ${state} ${zip}`.trim();
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
			return {
				lat: parseFloat(results[0].lat),
				lng: parseFloat(results[0].lon),
			};
		}
	} catch {
		// fall through
	}
	return null;
}

export function AddShowForm({
	artistId,
	onDone,
}: {
	artistId: string;
	onDone: () => void;
}) {
	const create = useCreateArtistShow();
	const [title, setTitle] = useState("");
	const [start, setStart] = useState("");
	const [venueName, setVenueName] = useState("");
	const [address, setAddress] = useState("");
	const [city, setCity] = useState("");
	const [state, setState] = useState("");
	const [zip, setZip] = useState("");
	const [ticketUrl, setTicketUrl] = useState("");
	const [genre, setGenre] = useState("");
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		if (!title.trim() || !start) {
			setError("Title and start time are required.");
			return;
		}

		const coords = await geocode(address, city, state, zip);
		if (!coords) {
			setError(
				"Couldn't locate that address. Add a more complete venue address so your show appears in listings.",
			);
			return;
		}

		try {
			await create.mutateAsync({
				id: artistId,
				data: {
					title: title.trim(),
					start_time: new Date(start).toISOString(),
					venue_name: venueName.trim() || undefined,
					address: address.trim() || undefined,
					city: city.trim() || undefined,
					state: state.trim() || undefined,
					zip: zip.trim() || undefined,
					latitude: coords.lat,
					longitude: coords.lng,
					ticket_url: ticketUrl.trim() || undefined,
					genre: genre ? [genre] : undefined,
					categories: ["Music"],
				},
			});
			onDone();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to add show.");
		}
	}

	return (
		<form
			onSubmit={handleSubmit}
			className="space-y-4 rounded-lg border border-(--line) bg-(--surface-strong) p-6"
		>
			<h2 className="text-lg font-semibold text-(--sea-ink)">Add a show</h2>

			<label className={labelCls}>
				Title *
				<input
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					required
					className={inputCls}
				/>
			</label>

			<label className={labelCls}>
				Date & time *
				<input
					type="datetime-local"
					value={start}
					onChange={(e) => setStart(e.target.value)}
					required
					className={inputCls}
				/>
			</label>

			<label className={labelCls}>
				Venue name
				<input
					value={venueName}
					onChange={(e) => setVenueName(e.target.value)}
					className={inputCls}
				/>
			</label>

			<label className={labelCls}>
				Address
				<input
					value={address}
					onChange={(e) => setAddress(e.target.value)}
					className={inputCls}
				/>
			</label>

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
				<label className={labelCls}>
					City
					<input
						value={city}
						onChange={(e) => setCity(e.target.value)}
						className={inputCls}
					/>
				</label>
				<label className={labelCls}>
					State
					<input
						value={state}
						onChange={(e) => setState(e.target.value)}
						className={inputCls}
					/>
				</label>
				<label className={labelCls}>
					Zip
					<input
						value={zip}
						onChange={(e) => setZip(e.target.value)}
						className={inputCls}
					/>
				</label>
			</div>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<label className={labelCls}>
					Genre
					<select
						value={genre}
						onChange={(e) => setGenre(e.target.value)}
						className={inputCls}
					>
						<option value="">—</option>
						{MUSIC_GENRES.map((g) => (
							<option key={g} value={g}>
								{g}
							</option>
						))}
					</select>
				</label>
				<label className={labelCls}>
					Ticket URL
					<input
						value={ticketUrl}
						onChange={(e) => setTicketUrl(e.target.value)}
						className={inputCls}
					/>
				</label>
			</div>

			{error && <p className="text-sm text-red-600">{error}</p>}

			<div className="flex gap-2">
				<button
					type="submit"
					disabled={create.isPending}
					className="cursor-pointer rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-medium text-(--foam) hover:opacity-90 disabled:opacity-50"
				>
					{create.isPending ? "Adding..." : "Add show"}
				</button>
				<button
					type="button"
					onClick={onDone}
					className="cursor-pointer rounded-md border border-(--line) px-4 py-2 text-sm font-medium text-(--sea-ink) hover:bg-(--surface)"
				>
					Cancel
				</button>
			</div>
		</form>
	);
}
