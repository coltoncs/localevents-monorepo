import { useState } from "react";
import { MUSIC_GENRES } from "#/components/music/ConcertFilters";
import type { Artist, CreateArtistInput } from "#/lib/types";

const inputCls =
	"mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)";
const labelCls = "block text-sm font-medium text-(--sea-ink-soft)";

export function ArtistForm({
	initial,
	onSubmit,
	submitting,
	error,
	submitLabel = "Save",
}: {
	initial?: Artist;
	onSubmit: (data: CreateArtistInput) => void;
	submitting: boolean;
	error?: string | null;
	submitLabel?: string;
}) {
	const [name, setName] = useState(initial?.Name ?? "");
	const [bio, setBio] = useState(initial?.Bio ?? "");
	const [genres, setGenres] = useState<string[]>(initial?.Genres ?? []);
	const [imageUrl, setImageUrl] = useState(initial?.ImageUrl ?? "");
	const [websiteUrl, setWebsiteUrl] = useState(initial?.WebsiteUrl ?? "");
	const [spotifyUrl, setSpotifyUrl] = useState(initial?.SpotifyUrl ?? "");
	const [instagramUrl, setInstagramUrl] = useState(initial?.InstagramUrl ?? "");
	const [bandcampUrl, setBandcampUrl] = useState(initial?.BandcampUrl ?? "");
	const [youtubeUrl, setYoutubeUrl] = useState(initial?.YoutubeUrl ?? "");
	const [city, setCity] = useState(initial?.HometownCity ?? "");
	const [state, setState] = useState(initial?.HometownState ?? "");

	function toggleGenre(g: string) {
		setGenres((cur) =>
			cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g],
		);
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		onSubmit({
			name: name.trim(),
			bio: bio.trim() || undefined,
			genres,
			image_url: imageUrl.trim() || undefined,
			website_url: websiteUrl.trim() || undefined,
			spotify_url: spotifyUrl.trim() || undefined,
			instagram_url: instagramUrl.trim() || undefined,
			bandcamp_url: bandcampUrl.trim() || undefined,
			youtube_url: youtubeUrl.trim() || undefined,
			hometown_city: city.trim() || undefined,
			hometown_state: state.trim() || undefined,
		});
	}

	return (
		<form
			onSubmit={handleSubmit}
			className="space-y-4 rounded-lg border border-(--line) bg-(--surface-strong) p-6"
		>
			<label className={labelCls}>
				Artist / band name *
				<input
					value={name}
					onChange={(e) => setName(e.target.value)}
					required
					className={inputCls}
				/>
			</label>

			<label className={labelCls}>
				Bio
				<textarea
					value={bio}
					onChange={(e) => setBio(e.target.value)}
					rows={4}
					className={inputCls}
				/>
			</label>

			<div>
				<span className={labelCls}>Genres</span>
				<div className="mt-2 flex flex-wrap gap-2">
					{MUSIC_GENRES.map((g) => {
						const active = genres.includes(g);
						return (
							<button
								key={g}
								type="button"
								onClick={() => toggleGenre(g)}
								className={`cursor-pointer rounded-full border px-3 py-1 text-sm transition ${
									active
										? "border-(--lagoon-deep) bg-(--lagoon-deep) text-(--foam)"
										: "border-(--line) text-(--sea-ink-soft) hover:border-(--lagoon-deep)"
								}`}
							>
								{g}
							</button>
						);
					})}
				</div>
			</div>

			<label className={labelCls}>
				Image URL
				<input
					value={imageUrl}
					onChange={(e) => setImageUrl(e.target.value)}
					placeholder="https://..."
					className={inputCls}
				/>
			</label>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
			</div>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<label className={labelCls}>
					Website
					<input
						value={websiteUrl}
						onChange={(e) => setWebsiteUrl(e.target.value)}
						className={inputCls}
					/>
				</label>
				<label className={labelCls}>
					Spotify
					<input
						value={spotifyUrl}
						onChange={(e) => setSpotifyUrl(e.target.value)}
						className={inputCls}
					/>
				</label>
				<label className={labelCls}>
					Instagram
					<input
						value={instagramUrl}
						onChange={(e) => setInstagramUrl(e.target.value)}
						className={inputCls}
					/>
				</label>
				<label className={labelCls}>
					Bandcamp
					<input
						value={bandcampUrl}
						onChange={(e) => setBandcampUrl(e.target.value)}
						className={inputCls}
					/>
				</label>
				<label className={labelCls}>
					YouTube
					<input
						value={youtubeUrl}
						onChange={(e) => setYoutubeUrl(e.target.value)}
						className={inputCls}
					/>
				</label>
			</div>

			{error && <p className="text-sm text-red-600">{error}</p>}

			<button
				type="submit"
				disabled={submitting || !name.trim()}
				className="cursor-pointer rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-medium text-(--foam) hover:opacity-90 disabled:opacity-50"
			>
				{submitting ? "Saving..." : submitLabel}
			</button>
		</form>
	);
}
