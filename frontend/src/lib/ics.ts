import { isAllDay } from "./date-utils";
import type { Event } from "./types";

function pad(n: number): string {
	return n.toString().padStart(2, "0");
}

function formatUtc(iso: string): string {
	const d = new Date(iso);
	return (
		d.getUTCFullYear().toString() +
		pad(d.getUTCMonth() + 1) +
		pad(d.getUTCDate()) +
		"T" +
		pad(d.getUTCHours()) +
		pad(d.getUTCMinutes()) +
		pad(d.getUTCSeconds()) +
		"Z"
	);
}

function formatDateOnly(iso: string): string {
	const d = new Date(iso);
	return d.getFullYear().toString() + pad(d.getMonth() + 1) + pad(d.getDate());
}

function addDays(iso: string, days: number): string {
	const d = new Date(iso);
	d.setDate(d.getDate() + days);
	return d.toISOString();
}

function escapeText(value: string): string {
	return value
		.replace(/\\/g, "\\\\")
		.replace(/\n/g, "\\n")
		.replace(/,/g, "\\,")
		.replace(/;/g, "\\;");
}

function stripHtml(html: string): string {
	return html
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/p>/gi, "\n\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

// RFC 5545 line folding: lines longer than 75 octets must be split.
function foldLine(line: string): string {
	if (line.length <= 75) return line;
	const parts: string[] = [];
	let i = 0;
	parts.push(line.slice(0, 75));
	i = 75;
	while (i < line.length) {
		parts.push(" " + line.slice(i, i + 74));
		i += 74;
	}
	return parts.join("\r\n");
}

export function buildEventIcs(event: Event): string {
	const allDay = isAllDay(event);
	const now = formatUtc(new Date().toISOString());
	const uid = `${event.ID}@919events.com`;

	const locationParts = [
		event.VenueName,
		event.Address,
		event.City,
		event.State,
		event.Zip,
	].filter(Boolean);
	const location = locationParts.join(", ");

	const descriptionParts: string[] = [];
	if (event.Description) descriptionParts.push(stripHtml(event.Description));
	if (event.TicketUrl) descriptionParts.push(`Tickets: ${event.TicketUrl}`);
	descriptionParts.push(
		`View on 919Events: https://919events.com/events/${event.ID}`,
	);
	const description = descriptionParts.join("\n\n");

	const lines: string[] = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//919Events//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		"BEGIN:VEVENT",
		`UID:${uid}`,
		`DTSTAMP:${now}`,
	];

	if (allDay) {
		// DTEND on all-day events is exclusive, so we add one day.
		lines.push(`DTSTART;VALUE=DATE:${formatDateOnly(event.StartTime)}`);
		lines.push(
			`DTEND;VALUE=DATE:${formatDateOnly(addDays(event.StartTime, 1))}`,
		);
	} else {
		lines.push(`DTSTART:${formatUtc(event.StartTime)}`);
		if (event.EndTime) {
			lines.push(`DTEND:${formatUtc(event.EndTime)}`);
		} else {
			// Default to a 2-hour event if no end time is provided.
			const fallbackEnd = new Date(event.StartTime);
			fallbackEnd.setHours(fallbackEnd.getHours() + 2);
			lines.push(`DTEND:${formatUtc(fallbackEnd.toISOString())}`);
		}
	}

	lines.push(`SUMMARY:${escapeText(event.Title)}`);
	if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
	if (location) lines.push(`LOCATION:${escapeText(location)}`);
	if (event.TicketUrl) lines.push(`URL:${event.TicketUrl}`);
	if (
		typeof event.Latitude === "number" &&
		typeof event.Longitude === "number" &&
		(event.Latitude !== 0 || event.Longitude !== 0)
	) {
		lines.push(`GEO:${event.Latitude};${event.Longitude}`);
	}

	lines.push("END:VEVENT", "END:VCALENDAR");

	return lines.map(foldLine).join("\r\n");
}

function safeFilename(title: string): string {
	return (
		title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 60) || "event"
	);
}

export function downloadEventIcs(event: Event) {
	const ics = buildEventIcs(event);
	const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `${safeFilename(event.Title)}.ics`;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	// Revoke after a tick so Safari has time to start the download.
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
