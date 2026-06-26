import { MessageCircle, X } from "lucide-react";
import { useState } from "react";
import { EventChat } from "#/components/chat/EventChat";

/**
 * Floating, app-wide entry point for the event assistant. Renders a launcher
 * button in the bottom-right corner; opening it mounts <EventChat>, which only
 * then opens its WebSocket connection (lazy connect on first open).
 */
export function ChatLauncher() {
	const [open, setOpen] = useState(false);

	return (
		<div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3">
			{open && (
				<div className="h-[min(40rem,calc(100vh-7rem))] w-[min(26rem,calc(100vw-2rem))]">
					<EventChat onClose={() => setOpen(false)} />
				</div>
			)}
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-label={open ? "Close event assistant" : "Open event assistant"}
				aria-expanded={open}
				className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-(--lagoon-deep) text-white shadow-lg transition hover:brightness-110"
			>
				{open ? <X size={22} /> : <MessageCircle size={22} />}
			</button>
		</div>
	);
}
