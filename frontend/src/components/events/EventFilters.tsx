import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

export const CATEGORIES = [
  'Music',
  'Sports',
  'Arts',
  'Kids',
  'Food & Drink',
  'Tech',
  'Entertainment',
  'Community',
  'Outdoors',
  'Nightlife',
  'Canes',
]

interface EventFiltersProps {
  category?: string
  date?: string
  endDate?: string
  radius?: number
  search?: string
  lat: number
  lng: number
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function EventFilters({
  category,
  date,
  endDate,
  radius,
  search,
  lat,
  lng,
}: EventFiltersProps) {
  const navigate = useNavigate()
  const [searchInput, setSearchInput] = useState(search ?? '')
  const [filtersOpen, setFiltersOpen] = useState(false)

  function updateSearch(updates: Record<string, string | undefined>) {
    navigate({
      to: '/events',
      search: (prev) => ({ ...prev, lat, lng, view: 'list' as const, page: undefined, ...updates }),
      replace: true,
    })
  }

  const startDate = date ? parseLocalDate(date) : null
  const endDateObj = endDate ? parseLocalDate(endDate) : null

  function handleDateChange(update: [Date | null, Date | null]) {
    const [start, end] = update
    const updates: Record<string, string | undefined> = {
      date: start ? formatDateStr(start) : undefined,
      endDate: end ? formatDateStr(end) : undefined,
    }
    updateSearch(updates)
  }

  const filterCount =
    (date ? 1 : 0) + (category ? 1 : 0) + (radius && radius !== 10 ? 1 : 0)

  const viewToggle = (
    <div className="flex rounded-md border border-(--line)">
      <button
        type="button"
        disabled
        className="cursor-default rounded-l-md bg-(--lagoon-deep) px-3 py-2 text-sm font-medium text-white"
      >
        List
      </button>
      <button
        type="button"
        onClick={() =>
          navigate({
            to: '/events',
            search: (prev) => ({ ...prev, lat, lng, view: undefined, page: undefined }),
            replace: true,
          })
        }
        className="cursor-pointer rounded-r-md bg-(--surface-strong) px-3 py-2 text-sm font-medium text-(--sea-ink-soft) hover:bg-(--surface)"
      >
        Map
      </button>
    </div>
  )

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-(--line) bg-(--surface-strong) p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          updateSearch({ search: searchInput.trim() || undefined })
        }}
        className="flex w-full gap-2 sm:w-auto"
      >
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search events..."
          className="w-full rounded-md border border-(--line) px-3 py-2 text-sm sm:w-48"
        />
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearchInput('')
              updateSearch({ search: undefined })
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
          aria-controls="event-filters-panel"
          className="flex flex-1 cursor-pointer items-center justify-between rounded-md border border-(--line) px-3 py-2 text-sm text-(--sea-ink) hover:bg-(--surface)"
        >
          <span className="flex items-center gap-2">
            <span>Filters</span>
            {filterCount > 0 && (
              <span className="rounded-full bg-(--lagoon-deep) px-1.5 py-0.5 text-xs font-semibold text-white">
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
            className={`transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
          >
            <path d="M2 4l4 4 4-4" />
          </svg>
        </button>
        {viewToggle}
      </div>

      <div
        id="event-filters-panel"
        className={
          filtersOpen
            ? 'flex w-full flex-col gap-3 sm:contents'
            : 'hidden sm:contents'
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
          value={category ?? ''}
          onChange={(e) =>
            updateSearch({ category: e.target.value || undefined })
          }
          className="w-full rounded-md border border-(--line) px-3 py-2 text-sm sm:w-auto"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={radius ?? 10}
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

      <div className="hidden sm:ml-auto sm:block">{viewToggle}</div>
    </div>
  )
}
