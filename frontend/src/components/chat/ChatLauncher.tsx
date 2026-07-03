import { MessageCircle, X } from "lucide-react";
import { useState } from "react";
import { EventChat } from "#/components/chat/EventChat";
import { track } from "#/lib/analytics";

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
				onClick={() =>
					setOpen((o) => {
						track(o ? "chat_close" : "chat_open");
						return !o;
					})
				}
				aria-label={open ? "Close event assistant" : "Open event assistant"}
				aria-expanded={open}
				className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-transparent bg-[linear-gradient(to_bottom_right,var(--pill-from),var(--pill-to))] text-(--pill-on) shadow-[var(--pill-glow)] transition-all duration-150 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-95"
			>
				{open ? <X size={22} /> : <MessageCircle size={22} />}
			</button>
		</div>
	);
}
