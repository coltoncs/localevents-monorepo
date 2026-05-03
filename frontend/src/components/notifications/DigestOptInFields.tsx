import { CATEGORIES } from "#/components/events/EventFilters";

export type DigestFormat = "daily" | "bulk";
export type EmailStyle = "detailed" | "compact";

interface DigestOptInFieldsProps {
	digestFormat: DigestFormat;
	onDigestFormatChange: (value: DigestFormat) => void;
	emailStyle: EmailStyle;
	onEmailStyleChange: (value: EmailStyle) => void;
	preferredCategories: string[];
	onPreferredCategoriesChange: (value: string[]) => void;
}

function PreviewOption({
	selected,
	onClick,
	label,
	description,
	children,
}: {
	selected: boolean;
	onClick: () => void;
	label: string;
	description: string;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={selected}
			className={`group flex w-full cursor-pointer flex-col rounded-lg border p-3 text-left transition ${
				selected
					? "border-(--lagoon-deep) bg-[rgba(79,184,178,0.08)] ring-1 ring-(--lagoon-deep)"
					: "border-(--line) bg-(--surface) hover:border-(--lagoon)"
			}`}
		>
			<div className="h-24 overflow-hidden rounded-md bg-(--surface-strong) px-3 py-3">
				{children}
			</div>
			<div className="mt-3 flex items-start gap-2">
				<span
					className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
						selected
							? "border-(--lagoon-deep)"
							: "border-(--line) group-hover:border-(--lagoon)"
					}`}
				>
					{selected && (
						<span className="h-1.5 w-1.5 rounded-full bg-(--lagoon-deep)" />
					)}
				</span>
				<span className="min-w-0 flex-1">
					<span className="block text-sm font-medium text-(--sea-ink)">
						{label}
					</span>
					<span className="block text-xs leading-snug text-(--sea-ink-soft)">
						{description}
					</span>
				</span>
			</div>
		</button>
	);
}

function GroupedByDayMock({ active }: { active: boolean }) {
	const bar = `h-1.5 rounded ${active ? "bg-(--lagoon)/60" : "bg-(--line)"}`;
	const label = `text-[9px] font-semibold tracking-wider ${
		active ? "text-(--lagoon-deep)" : "text-(--sea-ink-soft)"
	}`;
	const days: { day: string; widths: string[] }[] = [
		{ day: "MON", widths: ["w-full", "w-3/4"] },
		{ day: "TUE", widths: ["w-5/6", "w-2/3"] },
		{ day: "WED", widths: ["w-full", "w-1/2"] },
	];
	return (
		<div className="flex h-full flex-col gap-1.5">
			{days.map(({ day, widths }) => (
				<div key={day} className="flex items-center gap-2">
					<div className={`${label} w-7 shrink-0`}>{day}</div>
					<div className="flex-1 space-y-1">
						{widths.map((w) => (
							<div key={`${day}-${w}`} className={`${bar} ${w}`} />
						))}
					</div>
				</div>
			))}
		</div>
	);
}

function AllEventsMock({ active }: { active: boolean }) {
	const bar = `h-1.5 rounded ${active ? "bg-(--lagoon)/60" : "bg-(--line)"}`;
	return (
		<div className="h-full space-y-1.5">
			<div className={bar} />
			<div className={`${bar} w-5/6`} />
			<div className={bar} />
			<div className={`${bar} w-3/4`} />
			<div className={`${bar} w-11/12`} />
			<div className={`${bar} w-2/3`} />
			<div className={bar} />
		</div>
	);
}

function DetailedMock({ active }: { active: boolean }) {
	const tile = `rounded ${active ? "bg-(--lagoon)/40" : "bg-(--line)"}`;
	const bar = `h-1.5 rounded ${active ? "bg-(--lagoon)/60" : "bg-(--line)"}`;
	const thin = `h-1 rounded ${active ? "bg-(--lagoon)/50" : "bg-(--line)"}`;
	return (
		<div className="h-full space-y-2">
			<div className="flex gap-2">
				<div className={`${tile} h-9 w-9 shrink-0`} />
				<div className="flex-1 space-y-1 pt-1">
					<div className={bar} />
					<div className={`${bar} w-2/3`} />
					<div className={`${thin} w-1/2`} />
				</div>
			</div>
			<div className="flex gap-2">
				<div className={`${tile} h-7 w-9 shrink-0`} />
				<div className="flex-1 space-y-1 pt-1">
					<div className={bar} />
					<div className={`${thin} w-1/2`} />
				</div>
			</div>
		</div>
	);
}

function CompactMock({ active }: { active: boolean }) {
	const bar = `h-1.5 rounded ${active ? "bg-(--lagoon)/60" : "bg-(--line)"}`;
	return (
		<div className="h-full space-y-2 pt-1">
			{[1, 2, 3, 4, 5].map((i) => (
				<div key={i} className="flex items-center gap-1.5">
					<div className={`${bar} flex-1`} />
					<div className={`${bar} w-8`} />
					<div className={`${bar} w-5`} />
				</div>
			))}
		</div>
	);
}

export function DigestOptInFields({
	digestFormat,
	onDigestFormatChange,
	emailStyle,
	onEmailStyleChange,
	preferredCategories,
	onPreferredCategoriesChange,
}: DigestOptInFieldsProps) {
	return (
		<>
			<div>
				<div className="mb-2 block text-sm font-medium text-(--sea-ink-soft)">
					Digest Format
				</div>
				<div className="grid grid-cols-2 gap-3">
					<PreviewOption
						selected={digestFormat === "daily"}
						onClick={() => onDigestFormatChange("daily")}
						label="Grouped by day"
						description="Closest events for each day of the week."
					>
						<GroupedByDayMock active={digestFormat === "daily"} />
					</PreviewOption>
					<PreviewOption
						selected={digestFormat === "bulk"}
						onClick={() => onDigestFormatChange("bulk")}
						label="All events"
						description="One list, sorted by your categories."
					>
						<AllEventsMock active={digestFormat === "bulk"} />
					</PreviewOption>
				</div>
			</div>

			<div>
				<div className="mb-2 block text-sm font-medium text-(--sea-ink-soft)">
					Email Style
				</div>
				<div className="grid grid-cols-2 gap-3">
					<PreviewOption
						selected={emailStyle === "detailed"}
						onClick={() => onEmailStyleChange("detailed")}
						label="Detailed"
						description="Rich cards with images, price, and category."
					>
						<DetailedMock active={emailStyle === "detailed"} />
					</PreviewOption>
					<PreviewOption
						selected={emailStyle === "compact"}
						onClick={() => onEmailStyleChange("compact")}
						label="Compact"
						description="Concise text list — name, venue, time."
					>
						<CompactMock active={emailStyle === "compact"} />
					</PreviewOption>
				</div>
			</div>

			<div>
				<div className="mb-2 block text-sm font-medium text-(--sea-ink-soft)">
					Preferred Categories (up to 3)
				</div>
				<p className="mb-2 text-xs text-(--sea-ink-soft)">
					{digestFormat === "daily"
						? "Events in these categories will be prioritized in your daily digest."
						: "Events in these categories will appear first in your digest."}
				</p>
				<div className="flex flex-wrap gap-2">
					{CATEGORIES.map((c) => {
						const selected = preferredCategories.includes(c);
						const atMax = preferredCategories.length >= 3 && !selected;
						return (
							<button
								key={c}
								type="button"
								disabled={atMax}
								onClick={() => {
									if (selected) {
										onPreferredCategoriesChange(
											preferredCategories.filter((cat) => cat !== c),
										);
									} else {
										onPreferredCategoriesChange([...preferredCategories, c]);
									}
								}}
								className={`cursor-pointer rounded-full border px-3 py-1 text-sm font-medium ${
									selected
										? "border-(--lagoon-deep) bg-[rgba(79,184,178,0.14)] text-(--lagoon-deep)"
										: "border-(--line) text-(--sea-ink-soft) hover:bg-(--surface)"
								} disabled:cursor-not-allowed disabled:opacity-40`}
							>
								{c}
							</button>
						);
					})}
				</div>
			</div>
		</>
	);
}
