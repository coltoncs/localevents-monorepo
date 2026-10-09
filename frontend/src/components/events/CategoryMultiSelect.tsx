import * as Popover from '@radix-ui/react-popover'
import { CATEGORIES } from '#/components/events/EventFilters'

// Selected categories travel in the URL as one comma-separated `category`
// param (?category=Music,Arts), so single-category links keep working and the
// server receives the same value. Unknown names are dropped.
export function parseCategoryParam(value?: string): string[] {
  if (!value) return []
  const picked = new Set(value.split(',').map((c) => c.trim()))
  return CATEGORIES.filter((c) => picked.has(c))
}

// Serializes in CATEGORIES order so the same selection always produces the
// same URL (and query cache key), regardless of click order.
export function serializeCategories(categories: string[]): string | undefined {
  const picked = new Set(categories)
  const ordered = CATEGORIES.filter((c) => picked.has(c))
  return ordered.length ? ordered.join(',') : undefined
}

export function formatCategoryLabel(categories: string[]): string {
  if (categories.length === 0) return 'All categories'
  if (categories.length <= 2) return categories.join(', ')
  return `${categories[0]} +${categories.length - 1}`
}

interface CategoryMultiSelectProps {
  value: string[]
  onChange: (categories: string[]) => void
  className?: string
}

export function CategoryMultiSelect({
  value,
  onChange,
  className,
}: CategoryMultiSelectProps) {
  const selected = new Set(value)

  function toggle(category: string) {
    const next = new Set(selected)
    if (next.has(category)) next.delete(category)
    else next.add(category)
    onChange(CATEGORIES.filter((c) => next.has(c)))
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`Categories: ${formatCategoryLabel(value)}`}
        className={`flex cursor-pointer items-center justify-between gap-2 text-left ${className ?? ''}`}
      >
        <span className="truncate">{formatCategoryLabel(value)}</span>
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
          className="shrink-0"
        >
          <path d="M2 4l4 4 4-4" />
        </svg>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          collisionPadding={16}
          className="z-[80] max-h-(--radix-popover-content-available-height) w-56 overflow-y-auto rounded-lg border border-(--line) bg-(--surface-strong) p-1 shadow-lg"
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-(--sea-ink-soft)">
              Categories
            </span>
            {value.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="cursor-pointer text-xs font-medium text-(--lagoon-deep) hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          {CATEGORIES.map((c) => (
            <label
              key={c}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-(--sea-ink) hover:bg-(--surface)"
            >
              <input
                type="checkbox"
                checked={selected.has(c)}
                onChange={() => toggle(c)}
                className="size-4 cursor-pointer accent-(--lagoon-deep)"
              />
              {c}
            </label>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
