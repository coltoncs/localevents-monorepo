import { useState } from 'react'
import { useCreateSuggestion } from '#/lib/hooks/useSuggestions'
import type { Venue } from '#/lib/types'

const inputClass =
  'mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon) bg-(--bg-base) text-(--sea-ink)'
const labelClass = 'block text-sm font-medium text-(--sea-ink-soft)'

export function SuggestVenueEditModal({
  venue,
  onClose,
}: {
  venue: Venue
  onClose: () => void
}) {
  const createSuggestion = useCreateSuggestion()
  const [name, setName] = useState(venue.VenueName)
  const [address, setAddress] = useState(venue.Address ?? '')
  const [city, setCity] = useState(venue.City ?? '')
  const [state, setState] = useState(venue.State ?? '')
  const [zip, setZip] = useState(venue.Zip ?? '')
  const [hours, setHours] = useState(venue.Hours ?? '')
  const [description, setDescription] = useState(venue.Description ?? '')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const changes: Record<string, unknown> = {}
    if (name !== venue.VenueName) changes.name = name
    if (address !== (venue.Address ?? '')) changes.address = address
    if (city !== (venue.City ?? '')) changes.city = city
    if (state !== (venue.State ?? '')) changes.state = state
    if (zip !== (venue.Zip ?? '')) changes.zip = zip
    if (hours !== (venue.Hours ?? '')) changes.hours = hours
    if (description !== (venue.Description ?? '')) changes.description = description

    if (Object.keys(changes).length === 0) {
      onClose()
      return
    }

    await createSuggestion.mutateAsync({
      target_type: 'venue',
      target_id: venue.ID,
      proposed_changes: changes,
    })
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="w-full max-w-lg rounded-lg border border-(--line) bg-(--surface-strong) p-6 text-center shadow-xl">
          <p className="text-lg font-semibold text-(--sea-ink)">Edit suggestion submitted</p>
          <p className="mt-1 text-sm text-(--sea-ink-soft)">
            An admin will review your suggested changes.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 cursor-pointer rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-semibold text-white hover:bg-(--lagoon)"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-(--line) bg-(--surface-strong) p-6 shadow-xl space-y-4"
      >
        <h2 className="text-lg font-semibold text-(--sea-ink)">Suggest Venue Edit</h2>
        <p className="text-sm text-(--sea-ink-soft)">
          Change the fields you think need updating. Only modified fields will be submitted for review.
        </p>

        <div>
          <label className={labelClass}>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelClass}>Address</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className={labelClass}>State</label>
              <input type="text" value={state} onChange={(e) => setState(e.target.value)} className={inputClass} />
            </div>
            <div className="w-24">
              <label className={labelClass}>ZIP</label>
              <input type="text" value={zip} onChange={(e) => setZip(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>

        <div>
          <label className={labelClass}>Hours</label>
          <input type="text" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. Mon-Fri 9am-5pm" className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
        </div>

        {createSuggestion.isError && (
          <p className="text-sm text-red-600">Failed to submit suggestion. Please try again.</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md border border-(--line) px-4 py-2 text-sm font-semibold text-(--sea-ink) hover:bg-(--surface)"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createSuggestion.isPending}
            className="cursor-pointer rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-(--lagoon) disabled:opacity-50"
          >
            {createSuggestion.isPending ? 'Submitting...' : 'Submit Suggestion'}
          </button>
        </div>
      </form>
    </div>
  )
}
