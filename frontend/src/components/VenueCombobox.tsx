import { useState, useRef, useEffect } from 'react'
import { useVenues } from '#/lib/hooks/useVenues'
import type { Venue } from '#/lib/types'

interface VenueComboboxProps {
  lat: number
  lng: number
  onSelect: (venue: Venue) => void
}

export function VenueCombobox({ lat, lng, onSelect }: VenueComboboxProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const hasCoords = lat !== 0 || lng !== 0
  const { data } = useVenues({ lat, lng, radius: 100 }, hasCoords)
  const venues = data?.venues ?? []

  const q = query.trim().toLowerCase()
  const filtered = q
    ? venues.filter((v) => v.VenueName.toLowerCase().includes(q))
    : venues

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(venue: Venue) {
    setQuery(venue.VenueName)
    setOpen(false)
    onSelect(venue)
  }

  return (
    <div ref={wrapperRef} className="sm:col-span-2">
      <label className="block text-sm font-medium text-[var(--sea-ink-soft)]">
        Search Existing Venues
      </label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Type to search venues..."
          className="mt-1 block w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm shadow-sm focus:border-[var(--lagoon)] focus:ring-[var(--lagoon)]"
        />
        {open && filtered.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-[var(--line)] bg-[var(--surface-strong)] py-1 shadow-lg">
            {filtered.slice(0, 20).map((venue) => (
              <li key={`${venue.VenueName}-${venue.Latitude}-${venue.Longitude}`}>
                <button
                  type="button"
                  onClick={() => handleSelect(venue)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-[rgba(79,184,178,0.08)]"
                >
                  <div className="font-medium text-[var(--sea-ink)]">
                    {venue.VenueName}
                  </div>
                  {(venue.Address || venue.City) && (
                    <div className="text-xs text-[var(--sea-ink-soft)]">
                      {[venue.Address, venue.City, venue.State]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
