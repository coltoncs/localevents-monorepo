import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'

const CATEGORIES = [
  'Music',
  'Sports',
  'Arts',
  'Food',
  'Tech',
  'Community',
  'Outdoors',
  'Nightlife',
]

interface EventFiltersProps {
  category?: string
  date?: string
  radius?: number
  search?: string
  view: 'list' | 'map'
  lat: number
  lng: number
}

export function EventFilters({
  category,
  date,
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

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-4">
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
          className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm sm:w-48"
        />
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearchInput('')
              updateSearch({ search: undefined })
            }}
            className="cursor-pointer rounded-md border border-[var(--line)] px-2 py-2 text-sm text-[var(--sea-ink-soft)] hover:bg-[var(--surface)]"
          >
            &times;
          </button>
        )}
      </form>

      <input
        type="date"
        value={date ?? ''}
        onChange={(e) => updateSearch({ date: e.target.value || undefined })}
        className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm sm:w-auto"
      />

      <select
        value={category ?? ''}
        onChange={(e) =>
          updateSearch({ category: e.target.value || undefined })
        }
        className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm sm:w-auto"
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
        className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm sm:w-auto"
      >
        {[5, 10, 25, 50, 100].map((r) => (
          <option key={r} value={r}>
            {r} miles
          </option>
        ))}
      </select>

      <div className="flex w-full rounded-md border border-[var(--line)] sm:ml-auto sm:w-auto">
        <button
          onClick={() => updateSearch({ view: 'list' })}
          className={`cursor-pointer flex-1 px-3 py-2 text-sm font-medium sm:flex-none ${
            view === 'list'
              ? 'bg-[var(--lagoon-deep)] text-white'
              : 'bg-[var(--surface-strong)] text-[var(--sea-ink-soft)] hover:bg-[var(--surface)]'
          } rounded-l-md`}
        >
          List
        </button>
        <button
          onClick={() => {
            const updates: Record<string, string | undefined> = { view: 'map' }
            if (!date) {
              const today = new Date()
              updates.date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
            }
            updateSearch(updates)
          }}
          className={`cursor-pointer flex-1 px-3 py-2 text-sm font-medium sm:flex-none ${
            view === 'map'
              ? 'bg-[var(--lagoon-deep)] text-white'
              : 'bg-[var(--surface-strong)] text-[var(--sea-ink-soft)] hover:bg-[var(--surface)]'
          } rounded-r-md`}
        >
          Map
        </button>
      </div>
    </div>
  )
}
