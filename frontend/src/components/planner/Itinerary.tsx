import { useAuth } from "@clerk/clerk-react";
import { Link } from "@tanstack/react-router";
import {
	Bookmark,
	BookmarkCheck,
	CalendarPlus,
	Check,
	Share2,
} from "lucide-react";
import { useState } from "react";
import { track } from "#/lib/analytics";
import { useCreateSharedPlan } from "#/lib/hooks/usePlanner";
import { useSavedEvents, useSaveEvent } from "#/lib/hooks/useSavedEvents";
import { downloadIcs } from "#/lib/ics";
import type { PlanDay, PlanItem, WeeklyPlan } from "#/lib/types";

// Itinerary renders a weekly plan grouped by day. In readOnly mode (e.g. a
// shared link viewed by a recipient) the per-day Save and Share actions are
// hidden, leaving only Add to Calendar.
export function Itinerary({
	plan,
	readOnly = false,
}: {
	plan: WeeklyPlan;
	readOnly?: boolean;
}) {
	const days = plan.days.filter((d) => d.items.length > 0 && new Date(d.date) > new Date(new Date().setUTCHours(-32)));
	if (days.length === 0) {
		return (
			<p className="rounded-lg border border-(--line) bg-(--surface-strong) p-6 text-center text-(--sea-ink-soft)">
				No events matched within range this week. Try widening the radius or
				clearing some interests.
			</p>
		);
	}
	return (
		<div className="space-y-8">
			{days.map((day) => (
				<DaySection
					key={day.date}
					day={day}
					weekOf={plan.week_of}
					readOnly={readOnly}
				/>
			))}
		</div>
	);
}

function DaySection({
	day,
	weekOf,
	readOnly,
}: {
	day: PlanDay;
	weekOf: string;
	readOnly: boolean;
}) {
	return (
		<section>
			<div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b-2 border-(--line) pb-2">
				<h2 className="text-lg font-bold text-(--sea-ink)">{day.weekday}</h2>
				<DayActions day={day} weekOf={weekOf} readOnly={readOnly} />
			</div>
			<ol className="space-y-3">
				{day.items.map((item) => (
					<ItineraryItem key={item.event_id} item={item} />
				))}
			</ol>
		</section>
	);
}

const dayActionClass =
	"inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-(--line) bg-(--surface-strong) px-2.5 py-1 text-xs font-medium text-(--sea-ink-soft) text-nowrap transition hover:bg-(--surface) disabled:cursor-default disabled:opacity-60";

function DayActions({
	day,
	weekOf,
	readOnly,
}: {
	day: PlanDay;
	weekOf: string;
	readOnly: boolean;
}) {
	const { isSignedIn } = useAuth();
	return (
		<div className="flex items-center gap-2">
			{!readOnly && isSignedIn && <SaveDayButton day={day} />}
			<CalendarDayButton day={day} />
			{!readOnly && <ShareDayButton day={day} weekOf={weekOf} />}
		</div>
	);
}

// SaveDayButton saves every event in the day to the user's saved events. Only
// rendered when signed in, so its auth-only hooks never fire for anon visitors.
function SaveDayButton({ day }: { day: PlanDay }) {
	const { data: saved } = useSavedEvents();
	const saveEvent = useSaveEvent();
	const [saving, setSaving] = useState(false);

	const savedIds = new Set((saved ?? []).map((e) => e.ID));
	const ids = day.items.map((i) => i.event_id);
	const allSaved = ids.length > 0 && ids.every((id) => savedIds.has(id));

	const handleSave = async () => {
		setSaving(true);
		const toSave = ids.filter((id) => !savedIds.has(id));
		track("planner_save_day", { event_count: toSave.length });
		try {
			await Promise.all(toSave.map((id) => saveEvent.mutateAsync(id)));
		} finally {
			setSaving(false);
		}
	};

	return (
		<button
			type="button"
			onClick={handleSave}
			disabled={allSaved || saving}
			title={allSaved ? "All events saved" : "Save all events this day"}
			className={dayActionClass}
		>
			{allSaved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
			{allSaved ? "Saved" : saving ? "Saving…" : "Save"}
		</button>
	);
}

function CalendarDayButton({ day }: { day: PlanDay }) {
	const handleDownload = () => {
		track("planner_add_to_calendar", { event_count: day.items.length });
		downloadIcs(
			`919events-${day.date}`,
			day.items.map((it) => ({
				uid: `${it.event_id}@919events.com`,
				title: it.title,
				start: it.start_time,
				location: it.venue_name,
				url: it.event_url,
				description: `View on 919Events: ${it.event_url}`,
			})),
		);
	};

	return (
		<button
			type="button"
			onClick={handleDownload}
			title="Download this day's events as an .ics calendar file"
			className={dayActionClass}
		>
			<CalendarPlus size={14} />
			Add to Calendar
		</button>
	);
}

// ShareDayButton persists a snapshot of the day's itinerary and shares a link
// that reproduces it for the recipient.
function ShareDayButton({ day, weekOf }: { day: PlanDay; weekOf: string }) {
	const createShare = useCreateSharedPlan();
	const [copied, setCopied] = useState(false);

	const handleShare = async () => {
		let token: string;
		try {
			const res = await createShare.mutateAsync({
				week_of: weekOf,
				days: [day],
			});
			token = res.token;
		} catch {
			return; // couldn't create the link
		}

		const origin =
			typeof window !== "undefined"
				? window.location.origin
				: "https://919events.com";
		const url = `${origin}/plan/${token}`;
		const text = `My plan for ${day.weekday} — 919Events`;
		const shareData: ShareData = {
			title: `Plan for ${day.weekday}`,
			text,
			url,
		};

		const canNativeShare =
			typeof navigator !== "undefined" &&
			typeof navigator.share === "function" &&
			(navigator.canShare?.(shareData) ?? true);

		if (canNativeShare) {
			try {
				await navigator.share(shareData);
				track("planner_share_day", { method: "native" });
				return;
			} catch (err) {
				// User dismissed the share sheet — don't fall back to copying.
				if (err instanceof Error && err.name === "AbortError") return;
			}
		}

		try {
			await navigator.clipboard.writeText(url);
			track("planner_share_day", { method: "clipboard" });
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard unavailable (e.g. insecure context) — nothing more to do.
		}
	};

	return (
		<button
			type="button"
			onClick={handleShare}
			disabled={createShare.isPending}
			title="Share this day's plan"
			className={dayActionClass}
		>
			{copied ? <Check size={14} /> : <Share2 size={14} />}
			{createShare.isPending ? "Sharing…" : copied ? "Copied!" : "Share"}
		</button>
	);
}

function ItineraryItem({ item }: { item: PlanItem }) {
	return (
		<li className="flex gap-4 rounded-lg border border-(--line) bg-(--surface-strong) p-3">
			<div className="w-20 shrink-0 text-sm font-semibold text-(--lagoon-deep)">
				{item.time_label}
			</div>
			{item.image_url && (
				<img
					src={item.image_url}
					alt=""
					className="h-16 w-24 shrink-0 rounded-md object-cover"
				/>
			)}
			<div className="min-w-0 flex-1">
				<Link
					to="/events/$eventId"
					params={{ eventId: item.event_id }}
					className="font-semibold text-(--sea-ink) no-underline hover:text-(--lagoon-deep)"
				>
					{item.title}
				</Link>
				<p className="mt-0.5 truncate text-sm text-(--sea-ink-soft)">
					{item.venue_name}
					{item.venue_name ? " · " : ""}
					{item.distance_miles.toFixed(1)} mi away
				</p>
				{item.category && (
					<span className="mt-1 inline-block rounded-full bg-[rgba(79,184,178,0.14)] px-2 py-0.5 text-xs font-medium text-(--lagoon-deep)">
						{item.category}
					</span>
				)}
			</div>
		</li>
	);
}
