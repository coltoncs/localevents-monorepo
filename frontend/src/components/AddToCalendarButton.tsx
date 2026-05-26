import { CalendarPlus } from "lucide-react";
import { downloadEventIcs } from "#/lib/ics";
import type { Event } from "#/lib/types";
import { isPastEvent } from "#/lib/date-utils";

export function AddToCalendarButton({ event }: { event: Event }) {
  return (
    <button
      type="button"
      onClick={() => downloadEventIcs(event)}
      disabled={isPastEvent(event)}
      title="Download .ics file for Apple Calendar, Google Calendar, Outlook, etc."
      className={`${isPastEvent(event) ? "cursor-not-allowed" : "cursor-pointer"} inline-flex items-center gap-1.5 rounded-md border border-(--line) bg-(--surface-strong) px-3 py-1.5 text-sm font-medium text-(--sea-ink-soft) text-nowrap hover:bg-(--surface)`}
    >
      <CalendarPlus size={15} />
      Add to Calendar
    </button>
  );
}
