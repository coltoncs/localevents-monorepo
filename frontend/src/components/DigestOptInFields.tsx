import { CATEGORIES } from "#/components/EventFilters";

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
				<label className="block text-sm font-medium text-(--sea-ink-soft) mb-2">
					Digest Format
				</label>
				<div className="space-y-2">
					<label className="flex items-start gap-3 cursor-pointer">
						<input
							type="radio"
							name="digestFormat"
							value="daily"
							checked={digestFormat === "daily"}
							onChange={() => onDigestFormatChange("daily")}
							className="mt-0.5 h-4 w-4 border-(--line) text-(--lagoon-deep) focus:ring-(--lagoon)"
						/>
						<div>
							<span className="text-sm text-(--sea-ink)">Grouped by day</span>
							<p className="text-xs text-(--sea-ink-soft)">
								See the closest events for each day of the week (up to 10 per
								day).
							</p>
						</div>
					</label>
					<label className="flex items-start gap-3 cursor-pointer">
						<input
							type="radio"
							name="digestFormat"
							value="bulk"
							checked={digestFormat === "bulk"}
							onChange={() => onDigestFormatChange("bulk")}
							className="mt-0.5 h-4 w-4 border-(--line) text-(--lagoon-deep) focus:ring-(--lagoon)"
						/>
						<div>
							<span className="text-sm text-(--sea-ink)">All events</span>
							<p className="text-xs text-(--sea-ink-soft)">
								Receive all nearby events in a single list, sorted by your
								preferred categories.
							</p>
						</div>
					</label>
				</div>
			</div>

			<div>
				<label className="block text-sm font-medium text-(--sea-ink-soft) mb-2">
					Email Style
				</label>
				<div className="space-y-2">
					<label className="flex items-start gap-3 cursor-pointer">
						<input
							type="radio"
							name="emailStyle"
							value="detailed"
							checked={emailStyle === "detailed"}
							onChange={() => onEmailStyleChange("detailed")}
							className="mt-0.5 h-4 w-4 border-(--line) text-(--lagoon-deep) focus:ring-(--lagoon)"
						/>
						<div>
							<span className="text-sm text-(--sea-ink)">Detailed</span>
							<p className="text-xs text-(--sea-ink-soft)">
								Rich cards with images, price, and category for each event.
							</p>
						</div>
					</label>
					<label className="flex items-start gap-3 cursor-pointer">
						<input
							type="radio"
							name="emailStyle"
							value="compact"
							checked={emailStyle === "compact"}
							onChange={() => onEmailStyleChange("compact")}
							className="mt-0.5 h-4 w-4 border-(--line) text-(--lagoon-deep) focus:ring-(--lagoon)"
						/>
						<div>
							<span className="text-sm text-(--sea-ink)">Compact</span>
							<p className="text-xs text-(--sea-ink-soft)">
								A concise text list showing event name, venue, and time on one
								line.
							</p>
						</div>
					</label>
				</div>
			</div>

			<div>
				<label className="block text-sm font-medium text-(--sea-ink-soft) mb-2">
					Preferred Categories (up to 3)
				</label>
				<p className="text-xs text-(--sea-ink-soft) mb-2">
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
								className={`cursor-pointer rounded-full px-3 py-1 text-sm font-medium border ${
									selected
										? "bg-[rgba(79,184,178,0.14)] border-(--lagoon-deep) text-(--lagoon-deep)"
										: "border-(--line) text-(--sea-ink-soft) hover:bg-(--surface)"
								} disabled:opacity-40 disabled:cursor-not-allowed`}
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
