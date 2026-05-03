import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuth, useClerk } from '@clerk/clerk-react'
import { useEvents, eventListOptions } from '#/lib/hooks/useEvents'
import { useVenue, venueDetailOptions, useUpdateVenue } from '#/lib/hooks/useVenues'
import { useUnsaveEvent, useSaveEvent, useSavedEvents } from '#/lib/hooks/useSavedEvents'
import { useUserRole } from '#/lib/hooks/useUserRole'
import { EventCard } from '#/components/events/EventCard'
import { Pagination } from '#/components/Pagination'
import { getSavedLocation } from '#/components/maps/LocationSearch'
import { SuggestVenueEditModal } from '#/components/venues/SuggestVenueEditModal'
import { Spinner } from '#/components/Spinner'
import { venueJsonLd } from '#/lib/seo'
import type { Venue } from '#/lib/types'

const RALEIGH = { lat: 35.7796, lng: -78.6382 }
const WIDE_RADIUS = 100
const PAGE_SIZE = 20

interface VenueSearch {
  page?: number
}

export const Route = createFileRoute('/venues/$venueId')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): VenueSearch => ({
    page: search.page ? Number(search.page) : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ context, params, deps }) => {
    const loc = getSavedLocation()
    const { lat, lng } = loc ?? RALEIGH
    const [venue] = await Promise.all([
      context.queryClient.ensureQueryData(venueDetailOptions(params.venueId)),
      context.queryClient.prefetchQuery(
        eventListOptions({
          lat,
          lng,
          radius: WIDE_RADIUS,
          venueId: params.venueId,
          page: deps.page,
        }),
      ),
    ])
    return venue
  },
  head: ({ loaderData }) => {
    const venue = loaderData as Venue | undefined
    if (!venue) return {}
    const parts = [venue.Address, venue.City, venue.State].filter(Boolean)
    const description = parts.length
      ? `Upcoming events at ${venue.VenueName} — ${parts.join(', ')}`
      : `Upcoming events at ${venue.VenueName}`
    return {
      meta: [
        { title: `${venue.VenueName} | 919Events` },
        { name: 'description', content: description },
        { property: 'og:title', content: venue.VenueName },
        { property: 'og:description', content: description },
      ],
      links: [
        { rel: 'canonical', href: `https://919events.com/venues/${venue.ID}` },
      ],
      scripts: [
        {
          type: 'application/ld+json',
          children: JSON.stringify(venueJsonLd(venue)),
        },
      ],
    }
  },
  component: VenuePage,
})

function VenueEditForm({ venue, onClose }: { venue: Venue; onClose: () => void }) {
  const updateVenue = useUpdateVenue()
  const [name, setName] = useState(venue.VenueName)
  const [address, setAddress] = useState(venue.Address || '')
  const [city, setCity] = useState(venue.City || '')
  const [state, setState] = useState(venue.State || '')
  const [zip, setZip] = useState(venue.Zip || '')
  const [hours, setHours] = useState(venue.Hours || '')
  const [description, setDescription] = useState(venue.Description || '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await updateVenue.mutateAsync({
      id: venue.ID,
      data: {
        name,
        address: address || undefined,
        city: city || undefined,
        state: state || undefined,
        zip: zip || undefined,
        latitude: venue.Latitude,
        longitude: venue.Longitude,
        hours: hours || undefined,
        description: description || undefined,
      },
    })
    onClose()
  }

  const inputClass = "mt-1 block w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm shadow-sm focus:border-[var(--lagoon)] focus:ring-[var(--lagoon)]"
  const labelClass = "block text-sm font-medium text-[var(--sea-ink-soft)]"

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-(--line) bg-(--surface-strong) p-4 space-y-4">
      <h2 className="text-lg font-semibold text-(--sea-ink)">Edit Venue</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass}>Name *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Address</label>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>City</label>
          <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className={labelClass}>State</label>
            <select value={state} onChange={(e) => setState(e.target.value)} className={inputClass}>
              <option value="">--</option>
              <option value="NC">NC</option>
              <option value="SC">SC</option>
              <option value="VA">VA</option>
            </select>
          </div>
          <div className="w-28">
            <label className={labelClass}>ZIP</label>
            <input type="text" value={zip} onChange={(e) => setZip(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Hours</label>
          <input type="text" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. Mon-Fri 9am-5pm" className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
        </div>
      </div>
      {updateVenue.isError && (
        <p className="text-sm text-red-600">Failed to update venue. Please try again.</p>
      )}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-md border border-(--line) px-4 py-2 text-sm font-semibold text-(--sea-ink) hover:bg-(--surface)"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={updateVenue.isPending}
          className="cursor-pointer rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-(--lagoon) disabled:opacity-50"
        >
          {updateVenue.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  )
}

function VenuePage() {
  const { venueId } = Route.useParams()
  const { page: searchPage } = Route.useSearch()
  const navigate = useNavigate()
  const loc = getSavedLocation()
  const unsave = useUnsaveEvent()
  const save = useSaveEvent()
  const { data: savedEvents } = useSavedEvents()
  const { isSignedIn } = useAuth()
  const { openSignIn } = useClerk()
  const { isAdmin } = useUserRole()
  const [editing, setEditing] = useState(false)
  const [showSuggestEdit, setShowSuggestEdit] = useState(false)
  const { lat, lng } = loc ?? RALEIGH
  const page = searchPage ?? 1

  const { data: venue, isLoading: venueLoading } = useVenue(venueId)
  const { data, isLoading: eventsLoading } = useEvents({
    lat,
    lng,
    radius: WIDE_RADIUS,
    venueId,
    page,
  })
  const events = data?.events ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const isLoading = venueLoading || eventsLoading

  function goToPage(p: number) {
    navigate({
      to: '/venues/$venueId',
      params: { venueId },
      search: { page: p > 1 ? p : undefined },
      replace: true,
      resetScroll: false,
    })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      <Link
        to="/events"
        className="text-sm text-(--lagoon-deep) hover:text-(--lagoon)"
      >
        &larr; Back to events
      </Link>

      {editing && venue ? (
        <VenueEditForm venue={venue} onClose={() => setEditing(false)} />
      ) : (
        <div>
          <div className="flex items-start justify-between">
            <h1 className="text-2xl font-bold text-(--sea-ink)">
              {venue?.VenueName ?? 'Venue'}
            </h1>
            <div className="flex gap-2">
              {!isAdmin && venue && (
                <button
                  type="button"
                  onClick={() => isSignedIn ? setShowSuggestEdit(true) : openSignIn()}
                  className="cursor-pointer rounded-md border border-(--line) bg-(--surface-strong) px-3 py-1.5 text-sm font-medium text-(--sea-ink) hover:bg-(--surface)"
                >
                  Suggest Edit
                </button>
              )}
              {isAdmin && venue && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="cursor-pointer rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Edit
                </button>
              )}
            </div>
          </div>
          {venue && (
            <div className="mt-1 space-y-1 text-sm text-(--sea-ink-soft)">
              {(venue.Address || venue.City) && (
                <p>
                  {[venue.Address, venue.City, venue.State, venue.Zip]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
              {venue.Hours && <p>Hours: {venue.Hours}</p>}
              {venue.Description && <p className="mt-2">{venue.Description}</p>}
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <Spinner className="py-12" />
      ) : events.length === 0 ? (
        <div className="py-12 text-center text-(--sea-ink-soft)">
          No upcoming events found at this venue.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            const isSaved = savedEvents?.length && savedEvents.find(savedEvent => event.ID === savedEvent.ID);
            return (
            <div key={event.ID} className="relative">
              <EventCard event={event} />
              {isSaved ? (<button
                onClick={() => unsave.mutate(event.ID)}
                disabled={unsave.isPending}
                className="absolute right-2 top-2 rounded-md bg-(--surface-strong)/90 px-2 py-1 text-xs font-medium text-red-600 shadow-sm hover:bg-red-50"
              >
                Unsave
              </button>) : (<button
                onClick={() => save.mutate(event.ID)}
                disabled={save.isPending}
                className="absolute right-2 top-2 rounded-md bg-(--surface-strong)/90 px-2 py-1 text-xs font-medium text-green-600 shadow-sm hover:bg-green-50"
              >
                Save
              </button>)}
            </div>
          )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
      )}

      {showSuggestEdit && venue && (
        <SuggestVenueEditModal venue={venue} onClose={() => setShowSuggestEdit(false)} />
      )}
    </div>
  )
}
