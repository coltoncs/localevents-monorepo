import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { formatDateOnly } from "#/lib/date-utils";
import type { Event } from "#/lib/types";

export function ShareButton({ event }: { event: Event }) {
	const [copied, setCopied] = useState(false);

	const url = `https://919events.com/events/${event.ID}`;
	const text = `Check out "${event.Title}" on ${formatDateOnly(event.StartTime)} — 919Events`;
	const shareData: ShareData = { title: event.Title, text, url };

	async function handleShare() {
		// On mobile, the Web Share API opens the native share sheet so users can
		// text the event to a friend. Elsewhere we fall back to copying the link.
		const canNativeShare =
			typeof navigator !== "undefined" &&
			typeof navigator.share === "function" &&
			(navigator.canShare?.(shareData) ?? true);

		if (canNativeShare) {
			try {
				await navigator.share(shareData);
				return;
			} catch (err) {
				// User dismissed the share sheet — don't fall back to copying.
				if (err instanceof Error && err.name === "AbortError") return;
			}
		}

		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard unavailable (e.g. insecure context) — nothing more to do.
		}
	}

	return (
		<button
			type="button"
			onClick={handleShare}
			title="Share this event"
			className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-(--line) bg-(--surface-strong) px-3 py-1.5 text-sm font-medium text-(--sea-ink-soft) text-nowrap hover:bg-(--surface)"
		>
			{copied ? <Check size={15} /> : <Share2 size={15} />}
			{copied ? "Copied!" : "Share"}
		</button>
	);
}
