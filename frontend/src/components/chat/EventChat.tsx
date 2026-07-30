import { useAgentChat } from "@cloudflare/ai-chat/react";
import { Link } from "@tanstack/react-router";
import { useAgent } from "agents/react";
import type { UIMessage } from "ai";
import { LocateFixed, MapPin, Send, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	getSavedLocation,
	NC_CITIES,
	type SavedLocation,
	saveLocation,
} from "#/components/maps/LocationSearch";
import { track } from "#/lib/analytics";
import { storageGet, storageSet } from "#/lib/storage";

const SESSION_KEY = "events_chat_session";

/** Stable per-browser session id so chat history persists across reloads. */
function getSessionId(): string {
	if (typeof window === "undefined") return "default";
	let id = storageGet(SESSION_KEY);
	if (!id) {
		id = `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
		storageSet(SESSION_KEY, id);
	}
	return id;
}

const SUGGESTIONS = [
	"What concerts are happening this weekend?",
	"Find free family events near me",
	"Any comedy shows this week?",
];

export function EventChat({ onClose }: { onClose?: () => void } = {}) {
	// useAgent opens a WebSocket; only connect after mount (client-side).
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [location, setLocation] = useState<SavedLocation | null>(null);

	useEffect(() => {
		setSessionId(getSessionId());
		setLocation(getSavedLocation());
	}, []);

	if (!sessionId) {
		return (
			<div className="flex h-full items-center justify-center rounded-2xl border border-(--line) bg-(--surface-strong) p-6 text-(--sea-ink-soft) shadow-2xl">
				Loading assistant…
			</div>
		);
	}

	return (
		<Chat
			sessionId={sessionId}
			location={location}
			onLocationChange={setLocation}
			onClose={onClose}
		/>
	);
}

function Chat({
	sessionId,
	location,
	onLocationChange,
	onClose,
}: {
	sessionId: string;
	location: SavedLocation | null;
	onLocationChange: (location: SavedLocation) => void;
	onClose?: () => void;
}) {
	const agent = useAgent({ agent: "event-chat-agent", name: sessionId });
	const { messages, sendMessage, status, stop, clearHistory } = useAgentChat({
		agent,
	});

	const [input, setInput] = useState("");
	const [showLocation, setShowLocation] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const isBusy = status === "submitted" || status === "streaming";

	// Authoritative event index built from the search_events tool outputs in the
	// conversation. Used to resolve in-chat links by title so navigation always
	// matches the event the user sees — never the id the model may have written
	// wrong (e.g. a different instance of a recurring event with the same title).
	const eventIndex = useMemo(() => buildEventIndex(messages), [messages]);

	// Location context sent alongside every message so the agent can search
	// "near me" without asking. The geocode tool covers other cities by name.
	const body = useMemo(
		() =>
			location
				? { lat: location.lat, lng: location.lng, locationLabel: location.name }
				: {},
		[location],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: re-scroll whenever the message list grows
	useEffect(() => {
		scrollRef.current?.scrollTo({
			top: scrollRef.current.scrollHeight,
			behavior: "smooth",
		});
	}, [messages.length]);

	function submit(text: string, source: "typed" | "suggestion" = "typed") {
		const trimmed = text.trim();
		if (!trimmed || isBusy) return;
		track("chat_message_sent", { source, has_location: !!location });
		sendMessage({ text: trimmed }, { body });
		setInput("");
	}

	return (
		<div className="flex h-full flex-col overflow-hidden rounded-2xl border border-(--line) bg-(--surface-strong) shadow-2xl">
			{/* Header */}
			<div className="flex items-center justify-between gap-3 border-b border-(--line) px-4 py-3">
				<div className="flex items-center gap-2">
					<Sparkles size={16} className="text-(--lagoon-deep)" />
					<span className="font-medium text-(--sea-ink)">Event Assistant</span>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setShowLocation((v) => !v)}
						aria-expanded={showLocation}
						title="Set search location"
						className="inline-flex max-w-[9rem] cursor-pointer items-center gap-1 rounded-md border border-(--line) bg-(--surface-strong) px-2 py-1 text-xs font-medium text-(--sea-ink-soft) transition hover:bg-(--surface)"
					>
						<MapPin size={13} className="shrink-0 text-(--lagoon-deep)" />
						<span className="truncate">
							{location ? location.name : "Set location"}
						</span>
					</button>
					{messages.length > 0 && (
						<button
							type="button"
							onClick={() => {
								track("chat_clear_history", {
									message_count: messages.length,
								});
								clearHistory();
							}}
							className="cursor-pointer rounded-md border border-(--line) bg-(--surface-strong) px-2.5 py-1 text-xs font-medium text-(--sea-ink-soft) transition hover:bg-(--surface)"
						>
							Clear
						</button>
					)}
					{onClose && (
						<button
							type="button"
							onClick={onClose}
							aria-label="Close chat"
							className="flex cursor-pointer items-center justify-center rounded-md p-1 text-(--sea-ink-soft) transition hover:bg-(--surface)"
						>
							<X size={16} />
						</button>
					)}
				</div>
			</div>

			{showLocation && (
				<LocationControl value={location} onChange={onLocationChange} />
			)}

			{/* Messages */}
			<div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
				{messages.length === 0 ? (
					<Empty
						onPick={(text) => submit(text, "suggestion")}
						disabled={isBusy}
					/>
				) : (
					messages.map((m) => (
						<MessageBubble key={m.id} message={m} eventIndex={eventIndex} />
					))
				)}
				{status === "submitted" && (
					<div className="text-sm text-(--sea-ink-soft)">Thinking…</div>
				)}
			</div>

			{/* Composer */}
			<form
				onSubmit={(e) => {
					e.preventDefault();
					submit(input);
				}}
				className="flex items-center gap-2 border-t border-(--line) p-3"
			>
				<input
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="Ask about local events…"
					className="flex-1 rounded-md border border-(--line) bg-(--surface) px-3 py-2 text-sm text-(--sea-ink) outline-none placeholder:text-(--sea-ink-soft) focus:border-(--lagoon-deep)"
				/>
				{isBusy ? (
					<button
						type="button"
						onClick={() => {
							track("chat_stop", { status });
							stop();
						}}
						className="cursor-pointer rounded-md border border-(--line) bg-(--surface-strong) px-3 py-2 text-sm font-medium text-(--sea-ink-soft) transition hover:bg-(--surface)"
					>
						Stop
					</button>
				) : (
					<button
						type="submit"
						disabled={!input.trim()}
						className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-(--line) bg-(--surface-strong) px-3 py-2 text-sm font-medium text-(--sea-ink-soft) transition hover:bg-(--surface) disabled:opacity-50"
					>
						<Send size={15} />
						Send
					</button>
				)}
			</form>
		</div>
	);
}

/** Lets the user pick the location the assistant searches around: a preset
 * city or their device location. Persists to the shared localStorage key so the
 * rest of the app stays in sync, and updates the chat's location immediately. */
function LocationControl({
	value,
	onChange,
}: {
	value: SavedLocation | null;
	onChange: (location: SavedLocation) => void;
}) {
	const [geolocating, setGeolocating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	function selectCity(name: string) {
		const coords = NC_CITIES[name];
		if (!coords) return;
		const loc = { name, lat: coords.lat, lng: coords.lng };
		track("chat_set_location", { method: "city" });
		saveLocation(loc);
		onChange(loc);
	}

	function useMyLocation() {
		if (!navigator.geolocation) {
			setError("Location isn't available in this browser.");
			return;
		}
		setGeolocating(true);
		setError(null);
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				setGeolocating(false);
				const loc = {
					name: "My location",
					lat: pos.coords.latitude,
					lng: pos.coords.longitude,
				};
				track("chat_set_location", { method: "device" });
				saveLocation(loc);
				onChange(loc);
			},
			() => {
				setGeolocating(false);
				setError("Couldn't get your location. Pick a city instead.");
			},
			{ timeout: 10000 },
		);
	}

	const selectedCity = value && value.name in NC_CITIES ? value.name : "";

	return (
		<div className="space-y-2 border-b border-(--line) bg-(--surface) px-4 py-3">
			<div className="flex items-center gap-2">
				<label className="flex-1">
					<span className="sr-only">Choose a city</span>
					<select
						value={selectedCity}
						onChange={(e) => selectCity(e.target.value)}
						className="w-full cursor-pointer rounded-md border border-(--line) bg-(--surface-strong) px-2 py-1.5 text-sm text-(--sea-ink) outline-none focus:border-(--lagoon-deep)"
					>
						<option value="">Choose a city…</option>
						{Object.keys(NC_CITIES).map((c) => (
							<option key={c} value={c}>
								{c}
							</option>
						))}
					</select>
				</label>
				<button
					type="button"
					onClick={useMyLocation}
					disabled={geolocating}
					className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-(--line) bg-(--surface-strong) px-2.5 py-1.5 text-xs font-medium text-(--sea-ink-soft) transition hover:bg-(--surface) disabled:opacity-50"
				>
					<LocateFixed size={14} />
					{geolocating ? "Locating…" : "Use my location"}
				</button>
			</div>
			{value ? (
				<p className="text-xs text-(--sea-ink-soft)">
					Searching near <span className="text-(--sea-ink)">{value.name}</span>
				</p>
			) : (
				<p className="text-xs text-(--sea-ink-soft)">
					Set a location so I can find events near you.
				</p>
			)}
			{error && <p className="text-xs text-red-500">{error}</p>}
		</div>
	);
}

function Empty({
	onPick,
	disabled,
}: {
	onPick: (text: string) => void;
	disabled: boolean;
}) {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-4 text-center">
			<p className="max-w-sm text-sm text-(--sea-ink-soft)">
				Ask me what's happening nearby — concerts, comedy, festivals, family
				outings, and more.
			</p>
			<div className="flex flex-wrap justify-center gap-2">
				{SUGGESTIONS.map((s) => (
					<button
						key={s}
						type="button"
						disabled={disabled}
						onClick={() => onPick(s)}
						className="cursor-pointer rounded-full border border-(--line) bg-(--surface) px-3 py-1.5 text-xs text-(--sea-ink-soft) transition hover:bg-(--surface-strong) disabled:opacity-50"
					>
						{s}
					</button>
				))}
			</div>
		</div>
	);
}

function MessageBubble({
	message,
	eventIndex,
}: {
	message: UIMessage;
	eventIndex: EventIndex;
}) {
	const isUser = message.role === "user";

	return (
		<div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
			<div
				className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
					isUser
						? "bg-(--lagoon-deep) text-white"
						: "bg-(--surface) text-(--sea-ink)"
				}`}
			>
				{message.parts.map((part, i) => {
					// Message parts stream in append-only with no stable id, so a
					// composite of message id + position is the best available key.
					const key = `${message.id}:${i}`;
					if (part.type === "text") {
						return (
							<div key={key} className="whitespace-pre-wrap leading-relaxed">
								<RichText text={part.text} eventIndex={eventIndex} />
							</div>
						);
					}
					// Surface tool activity (search_events / geocode_location) subtly.
					if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
						const label = part.type.replace(/^tool-/, "").replace(/_/g, " ");
						return (
							<div
								key={key}
								className="my-1 text-xs italic text-(--sea-ink-soft)"
							>
								{`Searching (${label})…`}
							</div>
						);
					}
					return null;
				})}
			</div>
		</div>
	);
}

// Authoritative title -> /events/{id} map and the set of valid event urls,
// derived from the search_events tool outputs in the conversation.
type EventIndex = { byTitle: Map<string, string>; validUrls: Set<string> };

function normTitle(s: string): string {
	return s.replace(/\*+/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function buildEventIndex(messages: UIMessage[]): EventIndex {
	const byTitle = new Map<string, string>();
	const validUrls = new Set<string>();
	for (const m of messages) {
		for (const part of m.parts as Array<Record<string, unknown>>) {
			const type = part.type;
			if (typeof type !== "string" || !type.startsWith("tool-")) continue;
			const output = part.output as { events?: unknown } | undefined;
			const events = output?.events;
			if (!Array.isArray(events)) continue;
			for (const e of events as Array<{ title?: string; url?: string }>) {
				if (!e?.url) continue;
				validUrls.add(e.url);
				if (e.title) byTitle.set(normTitle(e.title), e.url);
			}
		}
	}
	return { byTitle, validUrls };
}

/** Extract the `/events/{id}` id from a url, or null. */
function eventIdFromUrl(url: string): string | null {
	return url.match(/^\/events\/([^/?#]+)$/)?.[1] ?? null;
}

// Lightweight markdown-link renderer: turns [text](url) into clickable links,
// using TanStack Link for internal /events/* routes. Avoids a full markdown dep.
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

function RichText({
	text,
	eventIndex,
}: {
	text: string;
	eventIndex: EventIndex;
}) {
	const nodes: React.ReactNode[] = [];
	let lastIndex = 0;
	let match: RegExpExecArray | null;
	LINK_RE.lastIndex = 0;
	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex iteration
	while ((match = LINK_RE.exec(text)) !== null) {
		const [full, label, href] = match;
		if (match.index > lastIndex) {
			nodes.push(text.slice(lastIndex, match.index));
		}
		const eventMatch = href.match(/^\/events\/([^/?#]+)$/);
		if (eventMatch) {
			// Prefer the id of the event whose title matches the link text — the
			// model's hand-written id can point at the wrong instance. Fall back to
			// the written id only when the label doesn't match a known event.
			const authoritative = eventIndex.byTitle.get(normTitle(label));
			const eventId =
				(authoritative && eventIdFromUrl(authoritative)) || eventMatch[1];
			nodes.push(
				<Link
					key={match.index}
					to="/events/$eventId"
					params={{ eventId }}
					onClick={() => track("chat_event_link_click", { event_id: eventId })}
					className="underline"
				>
					{label}
				</Link>,
			);
		} else if (href.startsWith("/")) {
			nodes.push(
				<a
					key={match.index}
					href={href}
					onClick={() => track("chat_link_click", { kind: "internal" })}
					className="underline"
				>
					{label}
				</a>,
			);
		} else {
			nodes.push(
				<a
					key={match.index}
					href={href}
					target="_blank"
					rel="noopener noreferrer"
					onClick={() => track("chat_link_click", { kind: "external" })}
					className="underline"
				>
					{label}
				</a>,
			);
		}
		lastIndex = match.index + full.length;
	}
	if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
	return <>{nodes}</>;
}
