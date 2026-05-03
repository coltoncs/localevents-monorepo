import { useForm } from "@tanstack/react-form";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ImageUpload } from "#/components/ImageUpload";
import {
	LocationPickerMap,
	type PoiSelection,
} from "#/components/maps/LocationPickerMap";
import { getSavedLocation } from "#/components/maps/LocationSearch";
import { SimpleEditor } from "#/components/tiptap-templates/simple/simple-editor";
import { VenueCombobox } from "#/components/venues/VenueCombobox";
import {
	type CreateSeriesInstance,
	useCreateEventSeries,
} from "#/lib/hooks/useEvents";
import type { CreateEventInput, Venue } from "#/lib/types";
import { CATEGORIES } from "./EventFilters";

export function CategoryPicker({
	value,
	onChange,
}: {
	value: string[];
	onChange: (v: string[]) => void;
	className?: string;
	labelClassName?: string;
}) {
	const [customInput, setCustomInput] = useState("");

	function toggle(cat: string) {
		if (value.includes(cat)) {
			onChange(value.filter((c) => c !== cat));
		} else {
			onChange([...value, cat]);
		}
	}

	function addCustom() {
		const trimmed = customInput.trim();
		if (trimmed && !value.includes(trimmed)) {
			onChange([...value, trimmed]);
		}
		setCustomInput("");
	}

	return (
		<div className="sm:col-span-2">
			<label className={labelClass}>Categories</label>
			<div className="mt-1 flex flex-wrap gap-2">
				{CATEGORIES.map((c) => (
					<button
						key={c}
						type="button"
						onClick={() => toggle(c)}
						className={`cursor-pointer rounded-full px-3 py-1 text-sm font-medium border ${
							value.includes(c)
								? "bg-[rgba(79,184,178,0.14)] border-(--lagoon-deep) text-(--lagoon-deep)"
								: "border-(--line) text-(--sea-ink-soft) hover:bg-(--surface)"
						}`}
					>
						{c}
					</button>
				))}
			</div>
			{value.filter((c) => !CATEGORIES.includes(c)).length > 0 && (
				<div className="mt-2 flex flex-wrap gap-1.5">
					{value
						.filter((c) => !CATEGORIES.includes(c))
						.map((c) => (
							<span
								key={c}
								className="inline-flex items-center gap-1 rounded-full bg-[rgba(123,142,232,0.14)] px-2.5 py-0.5 text-xs font-medium text-(--lagoon-deep)"
							>
								{c}
								<button
									type="button"
									onClick={() => onChange(value.filter((v) => v !== c))}
									className="cursor-pointer text-(--sea-ink-soft) hover:text-(--sea-ink)"
								>
									&times;
								</button>
							</span>
						))}
				</div>
			)}
			<div className="mt-2 flex gap-2">
				<input
					type="text"
					value={customInput}
					onChange={(e) => setCustomInput(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							addCustom();
						}
					}}
					placeholder="Add custom category..."
					className={inputClass}
				/>
				<button
					type="button"
					onClick={addCustom}
					disabled={!customInput.trim()}
					className="cursor-pointer whitespace-nowrap rounded-md border border-(--line) px-3 py-2 text-sm font-medium text-(--sea-ink-soft) hover:bg-(--surface) disabled:opacity-50"
				>
					Add
				</button>
			</div>
		</div>
	);
}

type DateMode = "single" | "range" | "multiple";

interface EventFormProps {
	initialValues?: {
		title?: string;
		description?: string;
		venue_name?: string;
		venue_id?: string;
		address?: string;
		city?: string;
		state?: string;
		zip?: string;
		latitude?: number;
		longitude?: number;
		categories?: string[];
		image_url?: string;
		ticket_url?: string;
		price_min?: number;
		price_max?: number;
	};
}

function combineDateAndTime(date: Date, time: Date | null): Date {
	const result = new Date(date);
	if (time) {
		result.setHours(time.getHours(), time.getMinutes(), 0, 0);
	} else {
		result.setHours(0, 0, 0, 0);
	}
	return result;
}

function formatDateStr(d: Date): string {
	return d.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
	});
}

const inputClass =
	"mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)";
const labelClass = "block text-sm font-medium text-(--sea-ink-soft)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useAddressGeocode(form: {
	setFieldValue: (field: string, value: any) => void;
}) {
	const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
	const lastQueryRef = useRef("");

	const geocode = (
		address: string,
		city: string,
		state: string,
		zip: string,
	) => {
		if (!address || !city || !state) return;

		const query = `${address}, ${city}, ${state} ${zip}`.trim();
		if (query === lastQueryRef.current) return;
		lastQueryRef.current = query;

		clearTimeout(timerRef.current);
		timerRef.current = setTimeout(async () => {
			try {
				const params = new URLSearchParams({
					q: query,
					format: "json",
					limit: "1",
					countrycodes: "us",
				});
				const resp = await fetch(
					`https://nominatim.openstreetmap.org/search?${params}`,
					{
						headers: { "User-Agent": "919events.com" },
					},
				);
				const results = await resp.json();
				if (results.length > 0) {
					form.setFieldValue("latitude", parseFloat(results[0].lat));
					form.setFieldValue("longitude", parseFloat(results[0].lon));
				}
			} catch {
				// Silently fail — user can still place the pin manually.
			}
		}, 800);
	};

	useEffect(() => () => clearTimeout(timerRef.current), []);

	return geocode;
}

export function EventForm({ initialValues }: EventFormProps = {}) {
	const navigate = useNavigate();
	const router = useRouter();
	const createSeries = useCreateEventSeries();
	const savedLocation = getSavedLocation();

	const [dateMode, setDateMode] = useState<DateMode>("single");
	const [singleDate, setSingleDate] = useState<Date | null>(null);
	const [rangeStart, setRangeStart] = useState<Date | null>(null);
	const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
	const [multipleDates, setMultipleDates] = useState<Date[]>([]);
	const [startTime, setStartTime] = useState<Date | null>(null);
	const [endTime, setEndTime] = useState<Date | null>(null);
	const [sameTimeAllDays, setSameTimeAllDays] = useState(true);
	const [perDateTimes, setPerDateTimes] = useState<
		Map<number, { start: Date | null; end: Date | null }>
	>(new Map());
	const [dateError, setDateError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	function setPerDateTime(
		dateKey: number,
		field: "start" | "end",
		value: Date | null,
	) {
		setPerDateTimes((prev) => {
			const next = new Map(prev);
			const entry = next.get(dateKey) ?? { start: null, end: null };
			next.set(dateKey, { ...entry, [field]: value });
			return next;
		});
	}

	function getEventDates(): Date[] {
		switch (dateMode) {
			case "single":
				return singleDate ? [singleDate] : [];
			case "range": {
				if (!rangeStart || !rangeEnd) return [];
				const dates: Date[] = [];
				const current = new Date(rangeStart);
				while (current <= rangeEnd) {
					dates.push(new Date(current));
					current.setDate(current.getDate() + 1);
				}
				return dates;
			}
			case "multiple":
				return [...multipleDates].sort((a, b) => a.getTime() - b.getTime());
		}
	}

	const form = useForm({
		defaultValues: {
			title: initialValues?.title ?? "",
			description: initialValues?.description ?? "",
			venue_name: initialValues?.venue_name ?? "",
			venue_id: initialValues?.venue_id ?? "",
			address: initialValues?.address ?? "",
			city: initialValues?.city ?? "",
			state: initialValues?.state ?? "NC",
			zip: initialValues?.zip ?? "",
			latitude: initialValues?.latitude ?? savedLocation?.lat ?? 0,
			longitude: initialValues?.longitude ?? savedLocation?.lng ?? 0,
			categories: initialValues?.categories ?? [],
			image_url: initialValues?.image_url ?? "",
			ticket_url: initialValues?.ticket_url ?? "",
			price_min:
				initialValues?.price_min != null ? String(initialValues.price_min) : "",
			price_max:
				initialValues?.price_max != null ? String(initialValues.price_max) : "",
		} as Record<string, string | number | string[]>,
		onSubmit: async ({ value }) => {
			const eventDates = getEventDates();
			if (eventDates.length === 0) {
				setDateError("At least one date is required");
				return;
			}
			const usePerDate = dateMode === "multiple" && !sameTimeAllDays;
			if (!usePerDate && !startTime) {
				setDateError("Start time is required");
				return;
			}
			if (usePerDate) {
				const missing = eventDates.find(
					(d) => !perDateTimes.get(d.getTime())?.start,
				);
				if (missing) {
					setDateError(`Start time is required for ${formatDateStr(missing)}`);
					return;
				}
			}
			setDateError(null);
			setSubmitting(true);

			try {
				const base: Omit<CreateEventInput, "start_time" | "end_time"> = {
					title: value.title as string,
					latitude: Number(value.latitude),
					longitude: Number(value.longitude),
				};
				if (value.description) base.description = value.description as string;
				if (value.venue_name) base.venue_name = value.venue_name as string;
				if (value.address) base.address = value.address as string;
				if (value.city) base.city = value.city as string;
				if (value.state) base.state = value.state as string;
				if (value.zip) base.zip = value.zip as string;
				const cats = value.categories as string[];
				if (cats.length > 0) base.categories = cats;
				if (value.image_url) base.image_url = value.image_url as string;
				if (value.ticket_url) base.ticket_url = value.ticket_url as string;
				if (value.price_min) base.price_min = Number(value.price_min);
				if (value.price_max) base.price_max = Number(value.price_max);
				if (value.venue_id) base.venue_id = value.venue_id as string;

				const isRange = dateMode === "range" && eventDates.length > 1;
				const instances: CreateSeriesInstance[] = eventDates.map((date, i) => {
					const isFirst = i === 0;
					const isLast = i === eventDates.length - 1;
					if (usePerDate) {
						const times = perDateTimes.get(date.getTime());
						return {
							start_time: combineDateAndTime(
								date,
								times?.start ?? null,
							).toISOString(),
							end_time: times?.end
								? combineDateAndTime(date, times.end).toISOString()
								: undefined,
						};
					}
					if (!isRange) {
						return {
							start_time: combineDateAndTime(date, startTime).toISOString(),
							end_time: endTime
								? combineDateAndTime(date, endTime).toISOString()
								: undefined,
						};
					}
					if (isFirst) {
						return {
							start_time: combineDateAndTime(date, startTime).toISOString(),
						};
					}
					if (isLast) {
						return {
							start_time: combineDateAndTime(date, null).toISOString(),
							end_time: endTime
								? combineDateAndTime(date, endTime).toISOString()
								: undefined,
						};
					}
					const endOfDay = new Date(date);
					endOfDay.setHours(23, 59, 0, 0);
					return {
						start_time: combineDateAndTime(date, null).toISOString(),
						end_time: endOfDay.toISOString(),
					};
				});

				const created = await createSeries.mutateAsync({ base, instances });

				if (created.length === 1) {
					navigate({
						to: "/events/$eventId",
						params: { eventId: created[0].ID },
					});
				} else {
					navigate({ to: "/events" });
				}
			} finally {
				setSubmitting(false);
			}
		},
	});

	function handleVenueSelect(venue: Venue) {
		form.setFieldValue("venue_name", venue.VenueName);
		form.setFieldValue("venue_id", venue.ID);
		form.setFieldValue("address", venue.Address || "");
		form.setFieldValue("city", venue.City || "");
		form.setFieldValue("state", venue.State || "");
		form.setFieldValue("zip", venue.Zip || "");
		form.setFieldValue("latitude", venue.Latitude);
		form.setFieldValue("longitude", venue.Longitude);
	}

	const geocode = useAddressGeocode(form);

	const eventDates = getEventDates();
	const eventCount = eventDates.length;

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-6"
		>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div className="sm:col-span-2">
					<form.Field
						name="title"
						validators={{
							onChange: ({ value }) =>
								!value ? "Title is required" : undefined,
						}}
					>
						{(field) => (
							<div>
								<label className={labelClass}>Title *</label>
								<input
									type="text"
									value={field.state.value as string}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									className={inputClass}
								/>
								{field.state.meta.errors?.length > 0 && (
									<p className="mt-1 text-sm text-red-600">
										{field.state.meta.errors[0]}
									</p>
								)}
							</div>
						)}
					</form.Field>
				</div>

				<div className="sm:col-span-2">
					<form.Field name="description">
						{(field) => (
							<div>
								<label className={labelClass}>Description</label>
								<div className="mt-1">
									<SimpleEditor
										content={field.state.value as string}
										onChange={(html) => field.handleChange(html)}
									/>
								</div>
							</div>
						)}
					</form.Field>
				</div>

				<form.Subscribe
					selector={(s) => [s.values.latitude, s.values.longitude]}
				>
					{([lat, lng]) => (
						<VenueCombobox
							lat={Number(lat) || 0}
							lng={Number(lng) || 0}
							onSelect={handleVenueSelect}
						/>
					)}
				</form.Subscribe>

				<form.Field name="venue_name">
					{(field) => (
						<div>
							<label className={labelClass}>Venue Name</label>
							<input
								type="text"
								value={field.state.value as string}
								onChange={(e) => field.handleChange(e.target.value)}
								className={inputClass}
							/>
						</div>
					)}
				</form.Field>

				<div className="sm:col-span-2 flex items-start gap-2.5 rounded-md border border-(--lagoon)/30 bg-[rgba(79,184,178,0.08)] px-3.5 py-2.5 text-sm">
					<svg
						className="mt-0.5 h-4 w-4 shrink-0 text-(--lagoon-deep)"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<title>Tip</title>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<p className="text-(--sea-ink)">
						<span className="font-semibold">Tip:</span> Search for the venue
						on the map below to autofill the address — or fill in the details
						manually.
					</p>
				</div>

				<form.Field name="address">
					{(field) => (
						<div>
							<label className={labelClass}>Address</label>
							<input
								type="text"
								value={field.state.value as string}
								onChange={(e) => field.handleChange(e.target.value)}
								className={inputClass}
							/>
						</div>
					)}
				</form.Field>

				<form.Field name="city">
					{(field) => (
						<div>
							<label className={labelClass}>City</label>
							<input
								type="text"
								value={field.state.value as string}
								onChange={(e) => field.handleChange(e.target.value)}
								className={inputClass}
							/>
						</div>
					)}
				</form.Field>

				<div className="flex gap-4">
					<form.Field name="state">
						{(field) => (
							<div className="flex-1">
								<label className={labelClass}>State</label>
								<select
									value={field.state.value as string}
									onChange={(e) => field.handleChange(e.target.value)}
									className={inputClass}
								>
									<option value="NC">NC</option>
									<option value="SC">SC</option>
									<option value="VA">VA</option>
								</select>
							</div>
						)}
					</form.Field>
					<form.Field name="zip">
						{(field) => (
							<div className="w-28">
								<label className={labelClass}>ZIP</label>
								<input
									type="text"
									value={field.state.value as string}
									onChange={(e) => field.handleChange(e.target.value)}
									className={inputClass}
								/>
							</div>
						)}
					</form.Field>
				</div>

				<form.Subscribe
					selector={(s) => [
						s.values.address,
						s.values.city,
						s.values.state,
						s.values.zip,
					]}
				>
					{([address, city, state, zip]) => {
						geocode(
							address as string,
							city as string,
							state as string,
							zip as string,
						);
						return null;
					}}
				</form.Subscribe>

				<div className="sm:col-span-2 relative py-2" aria-hidden="true">
					<div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-(--line)" />
					<div className="relative flex justify-center">
						<span className="bg-(--surface-strong) px-3 text-xs font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
							Or search the map
						</span>
					</div>
				</div>

				<div className="sm:col-span-2">
					<label className="block text-sm font-medium text-(--sea-ink-soft) mb-1">
						Event Location *
					</label>
					<form.Subscribe
						selector={(s) => [s.values.latitude, s.values.longitude]}
					>
						{([latitude, longitude]) => (
							<LocationPickerMap
								lat={Number(latitude) || 0}
								lng={Number(longitude) || 0}
								onCoordinateChange={(newLat, newLng) => {
									form.setFieldValue("latitude", newLat);
									form.setFieldValue("longitude", newLng);
								}}
								onPoiSelect={(poi: PoiSelection) => {
									if (poi.name) form.setFieldValue("venue_name", poi.name);
									if (poi.address) form.setFieldValue("address", poi.address);
									if (poi.city) form.setFieldValue("city", poi.city);
									if (poi.state) form.setFieldValue("state", poi.state);
									if (poi.zip) form.setFieldValue("zip", poi.zip);
									form.setFieldValue("latitude", poi.lat);
									form.setFieldValue("longitude", poi.lng);
								}}
							/>
						)}
					</form.Subscribe>
				</div>

				<form.Field
					name="latitude"
					validators={{
						onChange: ({ value }) =>
							!value && value !== 0 ? "Latitude is required" : undefined,
					}}
				>
					{(field) => (
						<div>
							<label className={labelClass}>Latitude *</label>
							<input
								type="number"
								step="any"
								value={field.state.value as number}
								onChange={(e) => field.handleChange(e.target.value)}
								className={inputClass}
							/>
							{field.state.meta.errors?.length > 0 && (
								<p className="mt-1 text-sm text-red-600">
									{field.state.meta.errors[0]}
								</p>
							)}
						</div>
					)}
				</form.Field>

				<form.Field
					name="longitude"
					validators={{
						onChange: ({ value }) =>
							!value && value !== 0 ? "Longitude is required" : undefined,
					}}
				>
					{(field) => (
						<div>
							<label className={labelClass}>Longitude *</label>
							<input
								type="number"
								step="any"
								value={field.state.value as number}
								onChange={(e) => field.handleChange(e.target.value)}
								className={inputClass}
							/>
							{field.state.meta.errors?.length > 0 && (
								<p className="mt-1 text-sm text-red-600">
									{field.state.meta.errors[0]}
								</p>
							)}
						</div>
					)}
				</form.Field>

				{/* Date & Time Section */}
				<div className="sm:col-span-2 space-y-4 rounded-lg border border-(--line) bg-(--surface) p-4">
					<div>
						<label className={labelClass}>Date Selection *</label>
						<div className="mt-1 flex rounded-md border border-(--line) w-fit">
							{(["single", "range", "multiple"] as const).map((mode, i) => (
								<button
									key={mode}
									type="button"
									onClick={() => {
										setDateMode(mode);
										setDateError(null);
									}}
									className={`cursor-pointer px-3 py-1.5 text-sm font-medium ${
										dateMode === mode
											? "bg-(--lagoon-deep) text-white"
											: "bg-(--surface-strong) text-(--sea-ink-soft) hover:bg-(--surface)"
									} ${i === 0 ? "rounded-l-md" : ""} ${i === 2 ? "rounded-r-md" : ""}`}
								>
									{mode === "single"
										? "Single Date"
										: mode === "range"
											? "Date Range"
											: "Multiple Dates"}
								</button>
							))}
						</div>
					</div>

					<div className="flex flex-wrap items-end gap-4">
						<div className="min-w-0 flex-1 basis-48">
							<label className={labelClass}>
								{dateMode === "single"
									? "Date *"
									: dateMode === "range"
										? "Date Range *"
										: "Select Dates *"}
							</label>
							<div className="mt-1">
								{dateMode === "single" && (
									<DatePicker
										selected={singleDate}
										onChange={(date: Date | null) => {
											setSingleDate(date);
											setDateError(null);
										}}
										minDate={new Date()}
										dateFormat="MMM d, yyyy"
										placeholderText="Select a date..."
										className={inputClass}
										calendarClassName="event-datepicker"
										isClearable
									/>
								)}
								{dateMode === "range" && (
									<DatePicker
										selectsRange
										startDate={rangeStart}
										endDate={rangeEnd}
										onChange={([start, end]) => {
											setRangeStart(start);
											setRangeEnd(end);
											setDateError(null);
										}}
										minDate={new Date()}
										dateFormat="MMM d, yyyy"
										placeholderText="Select date range..."
										className={inputClass}
										calendarClassName="event-datepicker"
										isClearable
									/>
								)}
								{dateMode === "multiple" && (
									<DatePicker
										selectsMultiple
										selectedDates={multipleDates}
										onChange={(dates: Date[] | null) => {
											setMultipleDates(dates ?? []);
											setDateError(null);
										}}
										minDate={new Date()}
										dateFormat="MMM d, yyyy"
										placeholderText="Click to select dates..."
										className={inputClass}
										calendarClassName="event-datepicker"
										shouldCloseOnSelect={false}
									/>
								)}
							</div>
						</div>

						{(dateMode !== "multiple" || sameTimeAllDays) && (
							<>
								<div className="min-w-0 flex-1 basis-36">
									<label className={labelClass}>Start Time *</label>
									<DatePicker
										selected={startTime}
										onChange={(date: Date | null) => {
											setStartTime(date);
											setDateError(null);
										}}
										showTimeSelect
										showTimeSelectOnly
										timeIntervals={15}
										timeCaption="Start"
										dateFormat="h:mm aa"
										placeholderText="Select start time..."
										className={inputClass}
										calendarClassName="event-datepicker"
									/>
								</div>

								<div className="min-w-0 flex-1 basis-36">
									<label className={labelClass}>End Time</label>
									<DatePicker
										selected={endTime}
										onChange={(date: Date | null) => setEndTime(date)}
										showTimeSelect
										showTimeSelectOnly
										timeIntervals={15}
										timeCaption="End"
										dateFormat="h:mm aa"
										placeholderText="Select end time..."
										className={inputClass}
										calendarClassName="event-datepicker"
										isClearable
									/>
								</div>
							</>
						)}
					</div>

					{dateMode === "multiple" && multipleDates.length > 0 && (
						<>
							<div className="flex flex-wrap gap-1.5">
								{[...multipleDates]
									.sort((a, b) => a.getTime() - b.getTime())
									.map((d, i) => (
										<span
											key={i}
											className="inline-flex items-center gap-1 rounded-full bg-[rgba(123,142,232,0.14)] px-2.5 py-0.5 text-xs font-medium text-(--lagoon-deep)"
										>
											{formatDateStr(d)}
											<button
												type="button"
												onClick={() =>
													setMultipleDates(
														multipleDates.filter((_, j) => j !== i),
													)
												}
												className="cursor-pointer text-(--sea-ink-soft) hover:text-(--sea-ink)"
											>
												&times;
											</button>
										</span>
									))}
							</div>

							<label className="flex items-center gap-2 text-sm text-(--sea-ink-soft) cursor-pointer w-fit">
								<input
									type="checkbox"
									checked={!sameTimeAllDays}
									onChange={(e) => setSameTimeAllDays(!e.target.checked)}
									className="accent-(--lagoon-deep)"
								/>
								Set individual times per day
							</label>

							{!sameTimeAllDays && (
								<div className="space-y-3">
									{[...multipleDates]
										.sort((a, b) => a.getTime() - b.getTime())
										.map((d) => {
											const key = d.getTime();
											const times = perDateTimes.get(key);
											return (
												<div
													key={key}
													className="flex flex-wrap items-end gap-3 rounded-md border border-(--line) bg-(--surface-strong) px-3 py-2.5"
												>
													<span className="self-center text-sm font-medium text-(--sea-ink) min-w-28">
														{formatDateStr(d)}
													</span>
													<div className="min-w-0 flex-1 basis-32">
														<label className="block text-xs font-medium text-(--sea-ink-soft)">
															Start *
														</label>
														<DatePicker
															selected={times?.start ?? null}
															onChange={(date: Date | null) =>
																setPerDateTime(key, "start", date)
															}
															showTimeSelect
															showTimeSelectOnly
															timeIntervals={15}
															timeCaption="Start"
															dateFormat="h:mm aa"
															placeholderText="Start time..."
															className={inputClass}
															calendarClassName="event-datepicker"
														/>
													</div>
													<div className="min-w-0 flex-1 basis-32">
														<label className="block text-xs font-medium text-(--sea-ink-soft)">
															End
														</label>
														<DatePicker
															selected={times?.end ?? null}
															onChange={(date: Date | null) =>
																setPerDateTime(key, "end", date)
															}
															showTimeSelect
															showTimeSelectOnly
															timeIntervals={15}
															timeCaption="End"
															dateFormat="h:mm aa"
															placeholderText="End time..."
															className={inputClass}
															calendarClassName="event-datepicker"
															isClearable
														/>
													</div>
												</div>
											);
										})}
								</div>
							)}
						</>
					)}

					{dateError && <p className="text-sm text-red-600">{dateError}</p>}

					{eventCount > 1 && (
						<p className="text-sm text-(--sea-ink-soft)">
							This will create{" "}
							<span className="font-semibold text-(--lagoon-deep)">
								{eventCount} events
							</span>{" "}
							with the same details, one for each selected date.
						</p>
					)}
				</div>

				<form.Field name="categories">
					{(field) => (
						<CategoryPicker
							value={field.state.value as string[]}
							onChange={(v) => field.handleChange(v)}
						/>
					)}
				</form.Field>

				<div className="sm:col-span-2">
					<form.Field name="image_url">
						{(field) => (
							<ImageUpload
								value={field.state.value as string}
								onChange={(url) => field.handleChange(url)}
							/>
						)}
					</form.Field>
				</div>

				<form.Field name="ticket_url">
					{(field) => (
						<div>
							<label className={labelClass}>Ticket URL</label>
							<input
								type="url"
								value={field.state.value as string}
								onChange={(e) => field.handleChange(e.target.value)}
								className={inputClass}
							/>
						</div>
					)}
				</form.Field>

				<form.Field name="price_min">
					{(field) => (
						<div>
							<label className={labelClass}>Min Price ($)</label>
							<input
								type="number"
								step="0.01"
								min="0"
								value={field.state.value as string}
								onChange={(e) => field.handleChange(e.target.value)}
								className={inputClass}
							/>
						</div>
					)}
				</form.Field>

				<form.Field name="price_max">
					{(field) => (
						<div>
							<label className={labelClass}>Max Price ($)</label>
							<input
								type="number"
								step="0.01"
								min="0"
								value={field.state.value as string}
								onChange={(e) => field.handleChange(e.target.value)}
								className={inputClass}
							/>
						</div>
					)}
				</form.Field>
			</div>

			{createSeries.isError && (
				<p className="text-sm text-red-600">
					Failed to create event. Please try again.
				</p>
			)}

			<div className="flex justify-end gap-3">
				<button
					type="button"
					onClick={() => router.history.back()}
					className="cursor-pointer rounded-md border border-(--line) px-6 py-2 text-sm font-semibold text-(--sea-ink) hover:bg-(--surface)"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={submitting}
					className="cursor-pointer rounded-md bg-(--lagoon-deep) px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-(--lagoon) disabled:opacity-50"
				>
					{submitting
						? eventCount > 1
							? `Creating ${eventCount} Events...`
							: "Submitting..."
						: eventCount > 1
							? `Submit ${eventCount} Events`
							: "Submit Event"}
				</button>
			</div>
		</form>
	);
}
