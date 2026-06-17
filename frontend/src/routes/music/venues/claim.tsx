import { useAuth } from "@clerk/clerk-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { getSavedLocation } from "#/components/maps/LocationSearch";
import { Spinner } from "#/components/Spinner";
import { VenueCombobox } from "#/components/venues/VenueCombobox";
import {
	useMyVenueClaims,
	useSubmitVenueClaim,
} from "#/lib/hooks/useVenueClaims";
import { DEFAULT_MAP_CENTER } from "#/lib/mapUtils";
import type { SubmitVenueClaimInput, Venue } from "#/lib/types";

export const Route = createFileRoute("/music/venues/claim")({
	head: () => ({
		meta: [
			{ title: "List Your Venue | 919Events" },
			{
				name: "description",
				content:
					"Claim or list your music venue so local artists can find you and send booking requests.",
			},
		],
	}),
	component: ClaimVenuePage,
});

// Best-effort one-shot geocode for a newly proposed venue. Returns null on any
// failure — the claim is still submitted and an admin can set coordinates.
async function geocode(
	address: string,
	city: string,
	state: string,
	zip: string,
): Promise<{ lat: number; lng: number } | null> {
	const query = `${address}, ${city}, ${state} ${zip}`.trim();
	if (!address || !city || !state) return null;
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

function StatusBadge({ status }: { status: string }) {
	const cls =
		status === "approved"
			? "bg-green-100 text-green-700"
			: status === "rejected"
				? "bg-red-100 text-red-700"
				: "bg-amber-100 text-amber-700";
	return (
		<span
			className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}
		>
			{status}
		</span>
	);
}

function ClaimVenuePage() {
	const { isSignedIn, isLoaded } = useAuth();
	const submit = useSubmitVenueClaim();
	const { data: myClaims } = useMyVenueClaims();

	const [mode, setMode] = useState<"existing" | "new">("existing");
	const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
	const [form, setForm] = useState({
		venueName: "",
		address: "",
		city: "",
		state: "",
		zip: "",
		contactName: "",
		contactEmail: "",
		bookingEmail: "",
		message: "",
	});
	const [error, setError] = useState<string | null>(null);
	const [submitted, setSubmitted] = useState(false);

	const saved = getSavedLocation();
	const lat = saved?.lat ?? DEFAULT_MAP_CENTER.lat;
	const lng = saved?.lng ?? DEFAULT_MAP_CENTER.lng;

	function set<K extends keyof typeof form>(key: K, value: string) {
		setForm((f) => ({ ...f, [key]: value }));
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);

		if (!form.contactName.trim() || !form.contactEmail.trim()) {
			setError("Your name and email are required.");
			return;
		}

		const payload: SubmitVenueClaimInput = {
			venue_name: "",
			contact_name: form.contactName.trim(),
			contact_email: form.contactEmail.trim(),
			booking_email: form.bookingEmail.trim() || undefined,
			message: form.message.trim() || undefined,
		};

		if (mode === "existing") {
			if (!selectedVenue) {
				setError("Please select a venue to claim.");
				return;
			}
			payload.venue_id = selectedVenue.ID;
			payload.venue_name = selectedVenue.VenueName;
		} else {
			if (!form.venueName.trim()) {
				setError("Venue name is required.");
				return;
			}
			payload.venue_name = form.venueName.trim();
			payload.address = form.address.trim() || undefined;
			payload.city = form.city.trim() || undefined;
			payload.state = form.state.trim() || undefined;
			payload.zip = form.zip.trim() || undefined;
			const coords = await geocode(
				form.address,
				form.city,
				form.state,
				form.zip,
			);
			if (coords) {
				payload.latitude = coords.lat;
				payload.longitude = coords.lng;
			}
		}

		try {
			await submit.mutateAsync(payload);
			setSubmitted(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to submit claim.");
		}
	}

	if (!isLoaded) return <Spinner className="py-24" />;

	if (!isSignedIn) {
		return (
			<div className="mx-auto max-w-xl px-4 py-16 text-center">
				<h1 className="text-2xl font-bold text-(--sea-ink)">List your venue</h1>
				<p className="mt-2 text-(--sea-ink-soft)">
					Please sign in to claim or list a venue.
				</p>
			</div>
		);
	}

	const inputCls =
		"mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)";

	return (
		<div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
			<div>
				<h1 className="text-2xl font-bold text-(--sea-ink)">List your venue</h1>
				<p className="mt-1 text-(--sea-ink-soft)">
					Claim an existing venue or add a new one. Once an admin approves it,
					your venue can receive booking requests from local artists.
				</p>
			</div>

			{myClaims && myClaims.length > 0 && (
				<div className="rounded-lg border border-(--line) bg-(--surface-strong) p-4">
					<h2 className="text-sm font-semibold text-(--sea-ink)">
						Your claims
					</h2>
					<ul className="mt-2 space-y-1">
						{myClaims.map((c) => (
							<li
								key={c.ID}
								className="flex items-center justify-between gap-2 text-sm"
							>
								<span className="text-(--sea-ink)">{c.VenueName}</span>
								<StatusBadge status={c.Status} />
							</li>
						))}
					</ul>
				</div>
			)}

			{submitted ? (
				<div className="rounded-lg border border-(--line) bg-(--surface-strong) p-6 text-center">
					<h2 className="text-lg font-semibold text-(--sea-ink)">
						Claim submitted
					</h2>
					<p className="mt-1 text-sm text-(--sea-ink-soft)">
						Thanks! An admin will review your request shortly.
					</p>
					<Link
						to="/music/venues"
						className="mt-4 inline-block rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-medium text-(--foam) hover:opacity-90"
					>
						Back to venues
					</Link>
				</div>
			) : (
				<form
					onSubmit={handleSubmit}
					className="space-y-5 rounded-lg border border-(--line) bg-(--surface-strong) p-6"
				>
					<div className="flex gap-2">
						{(["existing", "new"] as const).map((m) => (
							<button
								key={m}
								type="button"
								onClick={() => setMode(m)}
								className={`flex-1 cursor-pointer rounded-md border px-3 py-2 text-sm font-medium transition ${
									mode === m
										? "border-(--lagoon-deep) bg-(--lagoon-deep) text-(--foam)"
										: "border-(--line) text-(--sea-ink-soft) hover:border-(--lagoon-deep)"
								}`}
							>
								{m === "existing" ? "Claim existing venue" : "List a new venue"}
							</button>
						))}
					</div>

					{mode === "existing" ? (
						<div>
							<span className="block text-sm font-medium text-(--sea-ink-soft)">
								Find your venue
							</span>
							<div className="mt-1">
								<VenueCombobox
									lat={lat}
									lng={lng}
									onSelect={(v) => setSelectedVenue(v)}
								/>
							</div>
							{selectedVenue && (
								<p className="mt-2 text-sm text-(--sea-ink)">
									Selected: <strong>{selectedVenue.VenueName}</strong>
								</p>
							)}
						</div>
					) : (
						<div className="space-y-3">
							<label className="block text-sm font-medium text-(--sea-ink-soft)">
								Venue name *
								<input
									value={form.venueName}
									onChange={(e) => set("venueName", e.target.value)}
									className={inputCls}
								/>
							</label>
							<label className="block text-sm font-medium text-(--sea-ink-soft)">
								Address
								<input
									value={form.address}
									onChange={(e) => set("address", e.target.value)}
									className={inputCls}
								/>
							</label>
							<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
								<label className="block text-sm font-medium text-(--sea-ink-soft)">
									City
									<input
										value={form.city}
										onChange={(e) => set("city", e.target.value)}
										className={inputCls}
									/>
								</label>
								<label className="block text-sm font-medium text-(--sea-ink-soft)">
									State
									<input
										value={form.state}
										onChange={(e) => set("state", e.target.value)}
										className={inputCls}
									/>
								</label>
								<label className="block text-sm font-medium text-(--sea-ink-soft)">
									Zip
									<input
										value={form.zip}
										onChange={(e) => set("zip", e.target.value)}
										className={inputCls}
									/>
								</label>
							</div>
						</div>
					)}

					<hr className="border-(--line)" />

					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<label className="block text-sm font-medium text-(--sea-ink-soft)">
							Your name *
							<input
								value={form.contactName}
								onChange={(e) => set("contactName", e.target.value)}
								className={inputCls}
							/>
						</label>
						<label className="block text-sm font-medium text-(--sea-ink-soft)">
							Your email *
							<input
								type="email"
								value={form.contactEmail}
								onChange={(e) => set("contactEmail", e.target.value)}
								className={inputCls}
							/>
						</label>
					</div>

					<label className="block text-sm font-medium text-(--sea-ink-soft)">
						Booking email
						<input
							type="email"
							value={form.bookingEmail}
							onChange={(e) => set("bookingEmail", e.target.value)}
							placeholder="Where artists' booking requests are sent"
							className={inputCls}
						/>
						<span className="mt-1 block text-xs font-normal text-(--sea-ink-soft)">
							Provide this to let artists send booking requests once approved.
						</span>
					</label>

					<label className="block text-sm font-medium text-(--sea-ink-soft)">
						Message (optional)
						<textarea
							value={form.message}
							onChange={(e) => set("message", e.target.value)}
							rows={3}
							className={inputCls}
						/>
					</label>

					{error && <p className="text-sm text-red-600">{error}</p>}

					<button
						type="submit"
						disabled={submit.isPending}
						className="w-full cursor-pointer rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-medium text-(--foam) hover:opacity-90 disabled:opacity-50"
					>
						{submit.isPending ? "Submitting..." : "Submit claim"}
					</button>
				</form>
			)}
		</div>
	);
}
