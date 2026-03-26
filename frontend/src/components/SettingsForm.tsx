import { useState, useEffect, useRef } from 'react'
import { useForm } from '@tanstack/react-form'
import { useUser, useUpdateSettings } from '#/lib/hooks/useUser'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

interface GeocodingFeature {
  place_name: string
  center: [number, number] // [lng, lat]
}

export function SettingsForm() {
  const { data: user } = useUser()
  const updateSettings = useUpdateSettings()

  const [addressQuery, setAddressQuery] = useState('')
  const [suggestions, setSuggestions] = useState<GeocodingFeature[]>([])
  const [open, setOpen] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<{
    name: string
    lat: number
    lng: number
  } | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialize display from user's saved location
  useEffect(() => {
    if (user?.DefaultLatitude && user?.DefaultLongitude) {
      setSelectedLocation({
        name: '',
        lat: user.DefaultLatitude,
        lng: user.DefaultLongitude,
      })
      // Reverse geocode to show a readable name
      fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${user.DefaultLongitude},${user.DefaultLatitude}.json?access_token=${MAPBOX_TOKEN}&limit=1`,
      )
        .then((r) => r.json())
        .then((data) => {
          if (data.features?.length > 0) {
            setSelectedLocation({
              name: data.features[0].place_name,
              lat: user.DefaultLatitude!,
              lng: user.DefaultLongitude!,
            })
          }
        })
        .catch(() => {})
    }
  }, [user?.DefaultLatitude, user?.DefaultLongitude])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleAddressChange(value: string) {
    setAddressQuery(value)
    setOpen(true)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.trim().length < 3) {
      setSuggestions([])
      return
    }

    debounceRef.current = setTimeout(() => {
      fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json?access_token=${MAPBOX_TOKEN}&types=address,place,locality,neighborhood,postcode&limit=5&country=us`,
      )
        .then((r) => r.json())
        .then((data) => {
          setSuggestions(data.features ?? [])
        })
        .catch(() => setSuggestions([]))
    }, 300)
  }

  function handleSelect(feature: GeocodingFeature) {
    const [lng, lat] = feature.center
    setSelectedLocation({ name: feature.place_name, lat, lng })
    setAddressQuery('')
    setSuggestions([])
    setOpen(false)
  }

  const form = useForm({
    defaultValues: {
      default_radius_miles: user?.DefaultRadiusMiles ?? 10,
    },
    onSubmit: async ({ value }) => {
      await updateSettings.mutateAsync({
        default_latitude: selectedLocation?.lat || undefined,
        default_longitude: selectedLocation?.lng || undefined,
        default_radius_miles: Number(value.default_radius_miles) || undefined,
      })
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="space-y-6"
    >
      <div>
        <label className="block text-sm font-medium text-[var(--sea-ink-soft)]">
          Default Location
        </label>
        <div ref={wrapperRef} className="relative mt-1">
          <input
            type="text"
            value={addressQuery}
            onChange={(e) => handleAddressChange(e.target.value)}
            onFocus={() => addressQuery.trim().length >= 3 && setOpen(true)}
            placeholder={selectedLocation?.name || 'Enter an address or city...'}
            className="block w-full rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm shadow-sm focus:border-[var(--lagoon)] focus:ring-[var(--lagoon)] focus:outline-none"
          />
          {open && suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-[var(--line)] bg-[var(--surface-strong)] py-1 shadow-lg">
              {suggestions.map((feature) => (
                <li key={feature.place_name}>
                  <button
                    type="button"
                    onClick={() => handleSelect(feature)}
                    className="w-full px-3 py-2 text-left text-sm text-[var(--sea-ink-soft)] hover:bg-[rgba(79,184,178,0.08)] hover:text-[var(--lagoon-deep)]"
                  >
                    {feature.place_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {selectedLocation?.name && (
          <p className="mt-1.5 text-sm text-[var(--sea-ink-soft)]">
            {selectedLocation.name}
          </p>
        )}
      </div>

      <form.Field name="default_radius_miles">
        {(field) => (
          <div>
            <label className="block text-sm font-medium text-[var(--sea-ink-soft)]">
              Default Search Radius (miles)
            </label>
            <select
              value={field.state.value}
              onChange={(e) => field.handleChange(Number(e.target.value))}
              className="mt-1 block w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm shadow-sm focus:border-[var(--lagoon)] focus:ring-[var(--lagoon)]"
            >
              {[5, 10, 25, 50, 100].map((r) => (
                <option key={r} value={r}>
                  {r} miles
                </option>
              ))}
            </select>
          </div>
        )}
      </form.Field>

      {updateSettings.isSuccess && (
        <p className="text-sm text-green-600">Settings saved.</p>
      )}
      {updateSettings.isError && (
        <p className="text-sm text-red-600">Failed to save settings.</p>
      )}

      <button
        type="submit"
        disabled={updateSettings.isPending}
        className="rounded-md bg-[var(--lagoon-deep)] px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--lagoon)] disabled:opacity-50"
      >
        {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
      </button>
    </form>
  )
}
