import { useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// Canonical music genres. Mirrors CanonicalGenres in the Go scraper
// (server/internal/scraper/genre.go) — keep the two lists in sync.
export const MUSIC_GENRES = [
	"Rock",
	"Pop",
	"Hip-Hop/Rap",
	"R&B/Soul",
	"Country",
	"Folk/Americana",
	"Jazz",
	"Blues",
	"Electronic/EDM",
	"Classical",
	"Metal",
	"Punk",
	"Reggae",
	"Latin",
	"World",
	"Indie",
	"Other",
];

interface ConcertFiltersProps {
	genre?: string;
	date?: string;
	endDate?: string;
	radius?: number;
	search?: string;
	lat: number;
	lng: number;
}

function parseLocalDate(dateStr: string): Date {
	const [y, m, d] = dateStr.split("-").map(Number);
	return new Date(y, m - 1, d);
}

function formatDateStr(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
	const d = new Date(date);
	d.setDate(d.getDate() + days);
	return d;
}

// "This week" = today through the upcoming Sunday (inclusive).
function thisWeekRange(): [string, string] {
	const today = new Date();
	const dow = today.getDay(); // 0 = Sun … 6 = Sat
	const daysUntilSunday = dow === 0 ? 0 : 7 - dow;
	return [formatDateStr(today), formatDateStr(addDays(today, daysUntilSunday))];
}

// "This weekend" = the upcoming Saturday–Sunday (or the remainder of it if it's
// already the weekend).
function thisWeekendRange(): [string, string] {
	const today = new Date();
	const dow = today.getDay();
	if (dow === 6)
		return [formatDateStr(today), formatDateStr(addDays(today, 1))];
	if (dow === 0) return [formatDateStr(today), formatDateStr(today)];
	const sat = addDays(today, 6 - dow);
	return [formatDateStr(sat), formatDateStr(addDays(sat, 1))];
}

export function ConcertFilters({
	genre,
	date,
	endDate,
	radius,
	search,
	lat,
	lng,
}: ConcertFiltersProps) {
	const navigate = useNavigate();
	const [searchInput, setSearchInput] = useState(search ?? "");
	const [filtersOpen, setFiltersOpen] = useState(false);
	const panelId = useId();

	function updateSearch(updates: Record<string, string | undefined>) {
		navigate({
			to: "/music/concerts",
			search: (prev) => ({ ...prev, lat, lng, page: undefined, ...updates }),
			replace: true,
		});
	}

	const startDate = date ? parseLocalDate(date) : null;
	const endDateObj = endDate ? parseLocalDate(endDate) : null;

	function handleDateChange(update: [Date | null, Date | null]) {
		const [start, end] = update;
		updateSearch({
			date: start ? formatDateStr(start) : undefined,
			endDate: end ? formatDateStr(end) : undefined,
		});
	}

	const [weekStart, weekEnd] = thisWeekRange();
	const isThisWeek = date === weekStart && endDate === weekEnd;
	const [wknStart, wknEnd] = thisWeekendRange();
	const isThisWeekend = date === wknStart && endDate === wknEnd;

	const quickChip = (label: string, active: boolean, onClick: () => void) => (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition ${
				active
					? "border-(--lagoon-deep) bg-(--lagoon-deep) text-(--foam)"
					: "border-(--line) text-(--sea-ink-soft) hover:border-(--lagoon-deep) hover:text-(--lagoon-deep)"
			}`}
		>
			{label}
		</button>
	);

	const filterCount =
		(date ? 1 : 0) + (genre ? 1 : 0) + (radius && radius !== 25 ? 1 : 0);

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-2">
				{quickChip("This week", isThisWeek, () =>
					updateSearch(
						isThisWeek
							? { date: undefined, endDate: undefined }
							: { date: weekStart, endDate: weekEnd },
					),
				)}
				{quickChip("This weekend", isThisWeekend, () =>
					updateSearch(
						isThisWeekend
							? { date: undefined, endDate: undefined }
							: { date: wknStart, endDate: wknEnd },
					),
				)}
			</div>

			<div className="flex flex-wrap items-center gap-3 rounded-lg border border-(--line) bg-(--surface-strong) p-4">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						updateSearch({ search: searchInput.trim() || undefined });
					}}
					className="flex w-full gap-2 sm:w-auto"
				>
					<input
						type="text"
						value={searchInput}
						onChange={(e) => setSearchInput(e.target.value)}
						placeholder="Search artists, shows..."
						className="w-full rounded-md border border-(--line) px-3 py-2 text-sm sm:w-48"
					/>
					{search && (
						<button
							type="button"
							onClick={() => {
								setSearchInput("");
								updateSearch({ search: undefined });
							}}
							className="cursor-pointer rounded-md border border-(--line) px-2 py-2 text-sm text-(--sea-ink-soft) hover:bg-(--surface)"
						>
							&times;
						</button>
					)}
				</form>

				<div className="flex w-full items-center gap-2 sm:hidden">
					<button
						type="button"
						onClick={() => setFiltersOpen((v) => !v)}
						aria-expanded={filtersOpen}
						aria-controls={panelId}
						className="flex flex-1 cursor-pointer items-center justify-between rounded-md border border-(--line) px-3 py-2 text-sm text-(--sea-ink) hover:bg-(--surface)"
					>
						<span className="flex items-center gap-2">
							<span>Filters</span>
							{filterCount > 0 && (
								<span className="rounded-full bg-(--lagoon-deep) px-1.5 py-0.5 text-xs font-semibold text-(--foam)">
									{filterCount}
								</span>
							)}
						</span>
						<svg
							width="12"
							height="12"
							viewBox="0 0 12 12"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
							className={`transition-transform ${filtersOpen ? "rotate-180" : ""}`}
						>
							<path d="M2 4l4 4 4-4" />
						</svg>
					</button>
				</div>

				<div
					id={panelId}
					className={
						filtersOpen
							? "flex w-full flex-col gap-3 sm:contents"
							: "hidden sm:contents"
					}
				>
					<DatePicker
						selectsRange
						startDate={startDate}
						endDate={endDateObj}
						onChange={handleDateChange}
						isClearable
						placeholderText="Select dates..."
						dateFormat="MMM d, yyyy"
						className="w-full rounded-md border border-(--line) bg-transparent px-3 py-2 text-sm sm:w-52"
						calendarClassName="event-datepicker"
					/>

					<select
						value={genre ?? ""}
						onChange={(e) =>
							updateSearch({ genre: e.target.value || undefined })
						}
						className="w-full rounded-md border border-(--line) px-3 py-2 text-sm sm:w-auto"
					>
						<option value="">All Genres</option>
						{MUSIC_GENRES.map((g) => (
							<option key={g} value={g}>
								{g}
							</option>
						))}
					</select>

					<select
						value={radius ?? 25}
						onChange={(e) => updateSearch({ radius: e.target.value })}
						className="w-full rounded-md border border-(--line) px-3 py-2 text-sm sm:w-auto"
					>
						{[5, 10, 25, 50, 100].map((r) => (
							<option key={r} value={r}>
								{r} miles
							</option>
						))}
					</select>
				</div>
			</div>
		</div>
	);
}
