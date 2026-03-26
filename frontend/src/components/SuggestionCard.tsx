import { useState } from 'react'
import { useApproveSuggestion, useRejectSuggestion } from '#/lib/hooks/useSuggestions'
import type { EditSuggestion } from '#/lib/types'

const fieldLabels: Record<string, string> = {
  title: 'Title',
  description: 'Description',
  venue_name: 'Venue Name',
  name: 'Name',
  address: 'Address',
  city: 'City',
  state: 'State',
  zip: 'ZIP',
  latitude: 'Latitude',
  longitude: 'Longitude',
  start_time: 'Start Time',
  end_time: 'End Time',
  categories: 'Categories',
  image_url: 'Image URL',
  ticket_url: 'Ticket URL',
  price_min: 'Min Price',
  price_max: 'Max Price',
  hours: 'Hours',
}

function formatValue(value: unknown): string {
  if (value == null || value === '') return '(empty)'
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

export function SuggestionCard({ suggestion }: { suggestion: EditSuggestion }) {
  const approve = useApproveSuggestion()
  const reject = useRejectSuggestion()
  const [reviewNotes, setReviewNotes] = useState('')
  const [showReject, setShowReject] = useState(false)

  const changes = suggestion.ProposedChanges

  return (
    <div className="rounded-lg border border-(--line) bg-(--surface-strong) p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-(--sea-ink)">
            {suggestion.TargetName || suggestion.TargetID}
          </h3>
          <p className="text-xs text-(--sea-ink-soft)">
            {suggestion.TargetType === 'event' ? 'Event' : 'Venue'} edit suggestion
          </p>
        </div>
        <span className="text-xs text-(--sea-ink-soft)">
          {new Date(suggestion.CreatedAt).toLocaleDateString()}
        </span>
      </div>

      <div className="space-y-1.5">
        <h4 className="text-sm font-medium text-(--sea-ink-soft)">Proposed Changes</h4>
        {Object.entries(changes).map(([key, value]) => (
          <div key={key} className="flex gap-2 text-sm">
            <span className="font-medium text-(--sea-ink-soft) shrink-0">
              {fieldLabels[key] || key}:
            </span>
            <span className="text-(--sea-ink)">{formatValue(value)}</span>
          </div>
        ))}
      </div>

      {showReject && (
        <div>
          <label className="block text-sm font-medium text-(--sea-ink-soft)">
            Review Notes (optional)
          </label>
          <textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-md border border-(--line) px-3 py-2 text-sm shadow-sm focus:border-(--lagoon) focus:ring-(--lagoon)"
          />
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            approve.mutate({ id: suggestion.ID, review_notes: reviewNotes })
          }
          disabled={approve.isPending}
          className="cursor-pointer rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {approve.isPending ? 'Approving...' : 'Approve'}
        </button>
        {!showReject ? (
          <button
            type="button"
            onClick={() => setShowReject(true)}
            className="cursor-pointer rounded-md border border-red-300 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Reject
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              reject.mutate({ id: suggestion.ID, review_notes: reviewNotes })
            }
            disabled={reject.isPending}
            className="cursor-pointer rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {reject.isPending ? 'Rejecting...' : 'Confirm Reject'}
          </button>
        )}
      </div>
    </div>
  )
}
