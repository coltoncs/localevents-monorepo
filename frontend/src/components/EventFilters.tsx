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
]

interface EventFiltersProps {
  category?: string
  date?: string
  endDate?: string
  radius?: number
  search?: string
  view: 'list' | 'map'
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
  view,
  lat,
  lng,
}: EventFiltersProps) {
  const navigate = useNavigate()
  const [searchInput, setSearchInput] = useState(search ?? '')

  function updateSearch(updates: Record<string, string | undefined>) {
    navigate({
      to: '/events',
      search: (prev) => ({ ...prev, lat, lng, view, page: undefined, ...updates }),
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

      <div className="flex w-full rounded-md border border-(--line) sm:ml-auto sm:w-auto">
        <button
          onClick={() => updateSearch({ view: 'list' })}
          className={`cursor-pointer flex-1 px-3 py-2 text-sm font-medium sm:flex-none ${
            view === 'list'
              ? 'bg-(--lagoon-deep) text-white'
              : 'bg-(--surface-strong) text-(--sea-ink-soft) hover:bg-(--surface)'
          } rounded-l-md`}
        >
          List
        </button>
        <button
          onClick={() => {
            const updates: Record<string, string | undefined> = { view: 'map' }
            if (!date) {
              const today = new Date()
              updates.date = formatDateStr(today)
            }
            updateSearch(updates)
          }}
          className={`cursor-pointer flex-1 px-3 py-2 text-sm font-medium sm:flex-none ${
            view === 'map'
              ? 'bg-(--lagoon-deep) text-white'
              : 'bg-(--surface-strong) text-(--sea-ink-soft) hover:bg-(--surface)'
          } rounded-r-md`}
        >
          Map
        </button>
      </div>
    </div>
  )
}
