import { useForm } from '@tanstack/react-form'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { useCreateEvent } from '#/lib/hooks/useEvents'
import type { CreateEventInput, Venue } from '#/lib/types'
import { LocationPickerMap } from '#/components/LocationPickerMap'
import { VenueCombobox } from '#/components/VenueCombobox'
import { ImageUpload } from '#/components/ImageUpload'
import { getSavedLocation } from '#/components/LocationSearch'
import { SimpleEditor } from '#/components/tiptap-templates/simple/simple-editor'

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

export function EventForm() {
  const navigate = useNavigate()
  const router = useRouter()
  const createEvent = useCreateEvent()
  const savedLocation = getSavedLocation()

  const form = useForm({
    defaultValues: {
      title: '',
      description: '',
      venue_name: '',
      venue_id: '',
      address: '',
      city: '',
      state: 'NC',
      zip: '',
      latitude: savedLocation?.lat ?? 0,
      longitude: savedLocation?.lng ?? 0,
      start_time: '',
      end_time: '',
      category: '',
      image_url: '',
      ticket_url: '',
      price_min: '',
      price_max: '',
    } as Record<string, string | number>,
    onSubmit: async ({ value }) => {
      const data: CreateEventInput = {
        title: value.title as string,
        latitude: Number(value.latitude),
        longitude: Number(value.longitude),
        start_time: new Date(value.start_time as string).toISOString(),
      }

      if (value.description) data.description = value.description as string
      if (value.venue_name) data.venue_name = value.venue_name as string
      if (value.address) data.address = value.address as string
      if (value.city) data.city = value.city as string
      if (value.state) data.state = value.state as string
      if (value.zip) data.zip = value.zip as string
      if (value.end_time)
        data.end_time = new Date(value.end_time as string).toISOString()
      if (value.category) data.category = value.category as string
      if (value.image_url) data.image_url = value.image_url as string
      if (value.ticket_url) data.ticket_url = value.ticket_url as string
      if (value.price_min) data.price_min = Number(value.price_min)
      if (value.price_max) data.price_max = Number(value.price_max)
      if (value.venue_id) data.venue_id = value.venue_id as string

      const event = await createEvent.mutateAsync(data)
      navigate({ to: '/events/$eventId', params: { eventId: event.ID } })
    },
  })

  function handleVenueSelect(venue: Venue) {
    form.setFieldValue('venue_name', venue.VenueName)
    form.setFieldValue('venue_id', venue.ID)
    form.setFieldValue('address', venue.Address || '')
    form.setFieldValue('city', venue.City || '')
    form.setFieldValue('state', venue.State || '')
    form.setFieldValue('zip', venue.Zip || '')
    form.setFieldValue('latitude', venue.Latitude)
    form.setFieldValue('longitude', venue.Longitude)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <form.Field
            name="title"
            validators={{
              onChange: ({ value }) =>
                !value ? 'Title is required' : undefined,
            }}
          >
            {(field) => (
              <div>
                <label className="block text-sm font-medium text-(--sea-ink-soft)">
                  Title *
                </label>
                <input
                  type="text"
                  value={field.state.value as string}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)"
                />
                {field.state.meta.errors?.length > 0 && (
                  <p className="mt-1 text-sm text-red-600">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>
        </div>

        <div className="sm:col-span-2">
          <form.Field name="description">
            {(field) => (
              <div>
                <label className="block text-sm font-medium text-(--sea-ink-soft)">
                  Description
                </label>
                <div className="mt-1">
                  <SimpleEditor
                    content={field.state.value as string}
                    onChange={(html) => field.handleChange(html)}
                  />
                </div>
              </div>
            )}
          </form.Field>
        </div>

        <form.Subscribe selector={(s) => [s.values.latitude, s.values.longitude]}>
          {([lat, lng]) => (
            <VenueCombobox
              lat={Number(lat) || 0}
              lng={Number(lng) || 0}
              onSelect={handleVenueSelect}
            />
          )}
        </form.Subscribe>

        <form.Field name="venue_name">
          {(field) => (
            <div>
              <label className="block text-sm font-medium text-(--sea-ink-soft)">
                Venue Name
              </label>
              <input
                type="text"
                value={field.state.value as string}
                onChange={(e) => field.handleChange(e.target.value)}
                className="mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)"
              />
            </div>
          )}
        </form.Field>

        <form.Field name="address">
          {(field) => (
            <div>
              <label className="block text-sm font-medium text-(--sea-ink-soft)">
                Address
              </label>
              <input
                type="text"
                value={field.state.value as string}
                onChange={(e) => field.handleChange(e.target.value)}
                className="mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)"
              />
            </div>
          )}
        </form.Field>

        <form.Field name="city">
          {(field) => (
            <div>
              <label className="block text-sm font-medium text-(--sea-ink-soft)">
                City
              </label>
              <input
                type="text"
                value={field.state.value as string}
                onChange={(e) => field.handleChange(e.target.value)}
                className="mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)"
              />
            </div>
          )}
        </form.Field>

        <div className="flex gap-4">
          <form.Field name="state">
            {(field) => (
              <div className="flex-1">
                <label className="block text-sm font-medium text-(--sea-ink-soft)">
                  State
                </label>
                <select
                  value={field.state.value as string}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)"
                >
                  <option value="NC">NC</option>
                  <option value="SC">SC</option>
                  <option value="VA">VA</option>
                </select>
              </div>
            )}
          </form.Field>
          <form.Field name="zip">
            {(field) => (
              <div className="w-28">
                <label className="block text-sm font-medium text-(--sea-ink-soft)">
                  ZIP
                </label>
                <input
                  type="text"
                  value={field.state.value as string}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)"
                />
              </div>
            )}
          </form.Field>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-(--sea-ink-soft) mb-1">
            Event Location *
          </label>
          <form.Subscribe selector={(s) => [s.values.latitude, s.values.longitude]}>
            {([latitude, longitude]) => (
              <LocationPickerMap
                lat={Number(latitude) || 0}
                lng={Number(longitude) || 0}
                onCoordinateChange={(newLat, newLng) => {
                  form.setFieldValue('latitude', newLat)
                  form.setFieldValue('longitude', newLng)
                }}
              />
            )}
          </form.Subscribe>
        </div>

        <form.Field
          name="latitude"
          validators={{
            onChange: ({ value }) =>
              !value && value !== 0 ? 'Latitude is required' : undefined,
          }}
        >
          {(field) => (
            <div>
              <label className="block text-sm font-medium text-(--sea-ink-soft)">
                Latitude *
              </label>
              <input
                type="number"
                step="any"
                value={field.state.value as number}
                onChange={(e) => field.handleChange(e.target.value)}
                className="mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)"
              />
              {field.state.meta.errors?.length > 0 && (
                <p className="mt-1 text-sm text-red-600">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="longitude"
          validators={{
            onChange: ({ value }) =>
              !value && value !== 0 ? 'Longitude is required' : undefined,
          }}
        >
          {(field) => (
            <div>
              <label className="block text-sm font-medium text-(--sea-ink-soft)">
                Longitude *
              </label>
              <input
                type="number"
                step="any"
                value={field.state.value as number}
                onChange={(e) => field.handleChange(e.target.value)}
                className="mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)"
              />
              {field.state.meta.errors?.length > 0 && (
                <p className="mt-1 text-sm text-red-600">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="start_time"
          validators={{
            onChange: ({ value }) =>
              !value ? 'Start time is required' : undefined,
          }}
        >
          {(field) => (
            <div>
              <label className="block text-sm font-medium text-(--sea-ink-soft)">
                Start Time *
              </label>
              <input
                type="datetime-local"
                value={field.state.value as string}
                onChange={(e) => field.handleChange(e.target.value)}
                className="mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)"
              />
              {field.state.meta.errors?.length > 0 && (
                <p className="mt-1 text-sm text-red-600">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="end_time">
          {(field) => (
            <div>
              <label className="block text-sm font-medium text-(--sea-ink-soft)">
                End Time
              </label>
              <input
                type="datetime-local"
                value={field.state.value as string}
                onChange={(e) => field.handleChange(e.target.value)}
                className="mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)"
              />
            </div>
          )}
        </form.Field>

        <form.Field name="category">
          {(field) => (
            <div>
              <label className="block text-sm font-medium text-(--sea-ink-soft)">
                Category
              </label>
              <select
                value={field.state.value as string}
                onChange={(e) => field.handleChange(e.target.value)}
                className="mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)"
              >
                <option value="">Select a category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </form.Field>

        <div className="sm:col-span-2">
          <form.Field name="image_url">
            {(field) => (
              <ImageUpload
                value={field.state.value as string}
                onChange={(url) => field.handleChange(url)}
              />
            )}
          </form.Field>
        </div>

        <form.Field name="ticket_url">
          {(field) => (
            <div>
              <label className="block text-sm font-medium text-(--sea-ink-soft)">
                Ticket URL
              </label>
              <input
                type="url"
                value={field.state.value as string}
                onChange={(e) => field.handleChange(e.target.value)}
                className="mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)"
              />
            </div>
          )}
        </form.Field>

        <form.Field name="price_min">
          {(field) => (
            <div>
              <label className="block text-sm font-medium text-(--sea-ink-soft)">
                Min Price ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={field.state.value as string}
                onChange={(e) => field.handleChange(e.target.value)}
                className="mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)"
              />
            </div>
          )}
        </form.Field>

        <form.Field name="price_max">
          {(field) => (
            <div>
              <label className="block text-sm font-medium text-(--sea-ink-soft)">
                Max Price ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={field.state.value as string}
                onChange={(e) => field.handleChange(e.target.value)}
                className="mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)"
              />
            </div>
          )}
        </form.Field>
      </div>

      {createEvent.isError && (
        <p className="text-sm text-red-600">
          Failed to create event. Please try again.
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.history.back()}
          className="cursor-pointer rounded-md border border-(--line) px-6 py-2 text-sm font-semibold text-(--sea-ink) hover:bg-(--surface)"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={createEvent.isPending}
          className="cursor-pointer rounded-md bg-(--lagoon-deep) px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-(--lagoon) disabled:opacity-50"
        >
          {createEvent.isPending ? 'Submitting...' : 'Submit Event'}
        </button>
      </div>
    </form>
  )
}
