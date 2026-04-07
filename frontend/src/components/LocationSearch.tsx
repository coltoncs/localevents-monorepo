import { useState, useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'

const NC_CITIES: Record<string, { lat: number; lng: number }> = {
  Raleigh: { lat: 35.7796, lng: -78.6382 },
  Durham: { lat: 35.994, lng: -78.8986 },
  'Chapel Hill': { lat: 35.9132, lng: -79.0558 },
  'Wake Forest': { lat: 35.97572981255188, lng: -78.51321038126592 },
  Cary: { lat: 35.7915, lng: -78.7811 },
  Clayton: { lat: 35.6507, lng: -78.4564 },
  Charlotte: { lat: 35.2271, lng: -80.8431 },
  Greensboro: { lat: 36.0726, lng: -79.792 },
  'Winston-Salem': { lat: 36.0999, lng: -80.2442 },
  Fayetteville: { lat: 35.0527, lng: -78.8784 },
  Asheville: { lat: 35.5951, lng: -82.5515 },
  Wilmington: { lat: 34.2257, lng: -77.9447 },
}

const VA_CITIES: Record<string, { lat: number; lng: number }> = {
  Richmond: { lat: 37.5407, lng: -77.436 },
  'Virginia Beach': { lat: 36.8516, lng: -75.978 },
  Norfolk: { lat: 36.8508, lng: -76.2859 },
  Charlottesville: { lat: 38.0293, lng: -78.4767 },
  Roanoke: { lat: 37.271, lng: -79.9414 },
}

const SC_CITIES: Record<string, { lat: number; lng: number }> = {
  Charleston: { lat: 32.7765, lng: -79.9311 },
  Columbia: { lat: 34.0007, lng: -81.0348 },
  Greenville: { lat: 34.8526, lng: -82.394 },
  'Myrtle Beach': { lat: 33.6891, lng: -78.8867 },
}

const ALL_CITIES: Record<string, { lat: number; lng: number }> = {
  ...NC_CITIES,
  ...VA_CITIES,
  ...SC_CITIES,
}

const STORAGE_KEY = 'localevents_location'

export interface SavedLocation {
  name: string
  lat: number
  lng: number
}

export function getSavedLocation(): SavedLocation | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SavedLocation
  } catch {
    return null
  }
}

function saveLocation(location: SavedLocation) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(location))
  } catch {
    // storage full or unavailable
  }
}

export function LocationSearch({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [geolocating, setGeolocating] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function go(name: string, lat: number, lng: number) {
    saveLocation({ name, lat, lng })
    navigate({
      to: '/events',
      search: (prev) => ({ ...prev, lat, lng }),
    })
  }

  function handleGeolocate() {
    if (!navigator.geolocation) return
    setGeolocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeolocating(false)
        go('My Location', pos.coords.latitude, pos.coords.longitude)
      },
      () => {
        setGeolocating(false)
      },
      { timeout: 10000 },
    )
  }

  const [saved, setSaved] = useState<SavedLocation | null>(null)

  useEffect(() => {
    setSaved(getSavedLocation())
  }, [])

  const CITY_GROUPS = [
    { label: 'North Carolina', cities: NC_CITIES },
    { label: 'Virginia', cities: VA_CITIES },
    { label: 'South Carolina', cities: SC_CITIES },
  ]

  const q = query.trim().toLowerCase()
  const filteredGroups = CITY_GROUPS.map((group) => ({
    ...group,
    cities: Object.keys(group.cities).filter(
      (name) => !q || name.toLowerCase().startsWith(q),
    ),
  })).filter((group) => group.cities.length > 0)

  const matchingCities = filteredGroups.flatMap((g) => g.cities)

  function handleCitySelect(city: string) {
    const coords = ALL_CITIES[city]
    if (coords) {
      setQuery('')
      setOpen(false)
      go(city, coords.lat, coords.lng)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (matchingCities.length >= 1) {
      handleCitySelect(matchingCities[0])
    }
  }

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div ref={wrapperRef} className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search a city..."
            className={`w-full rounded-md border border-[var(--line)] px-4 text-sm bg-[var(--surface-strong)] focus:border-[var(--lagoon)] focus:ring-1 focus:ring-[var(--lagoon)] focus:outline-none ${compact ? 'py-2' : 'py-2.5'}`}
          />
          {open && filteredGroups.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-[var(--line)] bg-[var(--surface-strong)] py-1 shadow-lg">
              {filteredGroups.map((group) => (
                <li key={group.label}>
                  <div className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
                    {group.label}
                  </div>
                  <ul>
                    {group.cities.map((city) => (
                      <li key={city}>
                        <button
                          type="button"
                          onClick={() => handleCitySelect(city)}
                          className="w-full px-6 py-1.5 text-left text-sm text-[var(--sea-ink-soft)] hover:bg-[rgba(79,184,178,0.08)] hover:text-[var(--lagoon-deep)]"
                        >
                          {city}
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={handleGeolocate}
          disabled={geolocating}
          title="Use my location"
          className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--sea-ink-soft)] hover:bg-[var(--surface)] disabled:opacity-50"
        >
          {geolocating ? '...' : '\u{1F4CD}'}
        </button>
      </form>

      {saved && !compact && (
        <button
          type="button"
          onClick={() => go(saved.name, saved.lat, saved.lng)}
          className="mt-2 text-sm text-[var(--lagoon-deep)] hover:text-[var(--lagoon)]"
        >
          Use recent: {saved.name}
        </button>
      )}
    </div>
  )
}
