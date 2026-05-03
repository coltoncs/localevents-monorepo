import { useAuth, useClerk } from "@clerk/clerk-react";
import { Check, MapPin } from "lucide-react";
import { useState } from "react";
import { ApiError } from "#/lib/api";
import { getCurrentPosition } from "#/lib/geolocation";
import {
	useMyPlaceCheckInStatus,
	usePlaceCheckIn,
	usePlaceCheckInCounts,
} from "#/lib/hooks/usePlaceCheckIns";

export function PlaceCheckInButton({ placeId }: { placeId: string }) {
	const { isSignedIn } = useAuth();
	const { openSignIn } = useClerk();
	const checkIn = usePlaceCheckIn(placeId);
	const { data: status } = useMyPlaceCheckInStatus(placeId, !!isSignedIn);
	const { data: counts } = usePlaceCheckInCounts(placeId);
	const [error, setError] = useState<string | null>(null);
	const [locating, setLocating] = useState(false);

	const checkedInToday = !!status?.checkedInToday;
	const busy = locating || checkIn.isPending;

	async function handleClick() {
		setError(null);

		if (!isSignedIn) {
			openSignIn();
			return;
		}

		if (checkedInToday) return;

		try {
			setLocating(true);
			const coords = await getCurrentPosition();
			setLocating(false);
			await checkIn.mutateAsync({
				latitude: coords.latitude,
				longitude: coords.longitude,
			});
		} catch (err) {
			setLocating(false);
			if (err instanceof ApiError) {
				if (err.status === 403) {
					setError("You need to be at the venue to check in.");
				} else if (err.status === 409) {
					setError("You've already checked in today.");
				} else {
					setError("Check-in failed. Please try again.");
				}
				return;
			}
			if (err instanceof GeolocationPositionError) {
				if (err.code === err.PERMISSION_DENIED) {
					setError("Enable location access to check in.");
				} else {
					setError("Could not get your location. Try again.");
				}
				return;
			}
			setError("Check-in failed. Please try again.");
		}
	}

	return (
		<div className="flex flex-col items-end gap-1">
			<button
				type="button"
				onClick={handleClick}
				disabled={checkedInToday || busy}
				className={`cursor-pointer inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium text-nowrap transition ${
					checkedInToday
						? "border-(--lagoon) bg-[rgba(79,184,178,0.14)] text-(--lagoon-deep)"
						: "border-(--line) bg-(--surface-strong) text-(--sea-ink) hover:bg-(--surface)"
				} disabled:cursor-not-allowed disabled:opacity-70`}
			>
				{checkedInToday ? <Check size={15} /> : <MapPin size={15} />}
				{checkedInToday
					? "Checked in today"
					: busy
						? "Checking in…"
						: "Check in"}
				{counts && counts.unique > 0 && !checkedInToday ? (
					<span className="text-xs opacity-70">({counts.unique})</span>
				) : null}
			</button>
			{error ? <span className="text-xs text-red-600">{error}</span> : null}
		</div>
	);
}
