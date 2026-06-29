// Shared toggle-pill / badge styling used by the event form (Categories,
// Genre, and Date Selection toggles) and the event detail page badges.
// The filled state uses theme-aware gradient + glow tokens (--pill-*)
// defined in styles.css, so it adapts to light and dark mode.

const pillShape = "rounded-full border px-3.5 py-1.5 text-sm font-medium";

const pillFill =
	"border-transparent bg-[linear-gradient(to_bottom_right,var(--pill-from),var(--pill-to))] text-(--pill-on) shadow-[var(--pill-glow)]";

// Interactive toggle base (adds pointer + press feedback).
export const pillBase = `${pillShape} cursor-pointer transition-all duration-150 active:translate-y-0 active:scale-95`;

export const pillSelected = `-translate-y-0.5 ${pillFill}`;

export const pillUnselected =
	"border-(--line) bg-(--surface-strong) text-(--sea-ink-soft) shadow-sm hover:-translate-y-0.5 hover:border-(--lagoon) hover:text-(--lagoon-deep) hover:shadow-md";

// Static, non-interactive badge (event detail page): permanent gradient fill.
export const pillBadge = `inline-block ${pillShape} ${pillFill}`;
