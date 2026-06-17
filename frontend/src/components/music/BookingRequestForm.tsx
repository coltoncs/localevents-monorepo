import { useClerk, useUser } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { useBookingRequest } from "#/lib/hooks/useVenues";

// Booking-request form shown on a venue's page when the venue opted in. Emails
// the venue's booking contact; no request record is stored.
export function BookingRequestForm({
	venueId,
	venueName,
}: {
	venueId: string;
	venueName: string;
}) {
	const { isSignedIn, user } = useUser();
	const { openSignIn } = useClerk();
	const booking = useBookingRequest();

	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [message, setMessage] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [sent, setSent] = useState(false);

	// Prefill from the signed-in user once available.
	useEffect(() => {
		if (user) {
			setName((n) => n || user.fullName || "");
			setEmail((e) => e || user.primaryEmailAddress?.emailAddress || "");
		}
	}, [user]);

	const inputCls =
		"mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)";

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		if (!name.trim() || !email.trim() || !message.trim()) {
			setError("Please fill in your name, email, and a message.");
			return;
		}
		try {
			await booking.mutateAsync({
				id: venueId,
				data: {
					name: name.trim(),
					email: email.trim(),
					message: message.trim(),
				},
			});
			setSent(true);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to send booking request.",
			);
		}
	}

	return (
		<div className="rounded-lg border border-(--line) bg-(--surface-strong) p-4">
			<h2 className="text-lg font-semibold text-(--sea-ink)">
				Request a booking
			</h2>
			<p className="mt-1 text-sm text-(--sea-ink-soft)">
				Send {venueName} a message about playing here.
			</p>

			{sent ? (
				<p className="mt-3 text-sm font-medium text-(--lagoon-deep)">
					Your booking request was sent. The venue will reach out directly.
				</p>
			) : !isSignedIn ? (
				<button
					type="button"
					onClick={() => openSignIn()}
					className="mt-3 cursor-pointer rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-medium text-(--foam) hover:opacity-90"
				>
					Sign in to request a booking
				</button>
			) : (
				<form onSubmit={handleSubmit} className="mt-3 space-y-3">
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<label className="block text-sm font-medium text-(--sea-ink-soft)">
							Your name *
							<input
								value={name}
								onChange={(e) => setName(e.target.value)}
								className={inputCls}
							/>
						</label>
						<label className="block text-sm font-medium text-(--sea-ink-soft)">
							Your email *
							<input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className={inputCls}
							/>
						</label>
					</div>
					<label className="block text-sm font-medium text-(--sea-ink-soft)">
						Message *
						<textarea
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							rows={4}
							placeholder="Tell the venue about your act, links, and dates you have in mind."
							className={inputCls}
						/>
					</label>
					{error && <p className="text-sm text-red-600">{error}</p>}
					<button
						type="submit"
						disabled={booking.isPending}
						className="cursor-pointer rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-medium text-(--foam) hover:opacity-90 disabled:opacity-50"
					>
						{booking.isPending ? "Sending..." : "Send booking request"}
					</button>
				</form>
			)}
		</div>
	);
}
