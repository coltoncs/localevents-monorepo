import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@clerk/clerk-react'
import { useEvent, eventDetailOptions, useEvents, useDeleteEvent } from '#/lib/hooks/useEvents'
import { useUserRole } from '#/lib/hooks/useUserRole'
import { EventMap } from '#/components/EventMap'
import { SaveButton } from '#/components/SaveButton'
import { useUser } from '#/lib/hooks/useUser'
import type { Event } from '#/lib/types'

export const Route = createFileRoute('/events/$eventId/')({
  loader: async ({ context, params }) => {
    await context.queryClient.prefetchQuery(
      eventDetailOptions(params.eventId),
    )
  },
  component: EventDetailPage,
})

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function VenueName({ event }: { event: Event }) {
  const { data } = useEvents(
    { lat: event.Latitude, lng: event.Longitude, radius: 50, venueName: event.VenueName },
    !!event.VenueName,
  )

  const hasVenuePage = (data?.total ?? 0) > 0

  return (
    <div>
      <p className="text-[var(--sea-ink)]">
        {hasVenuePage ? (
          <Link
            to="/venues/$venueName"
            params={{ venueName: event.VenueName! }}
            className="hover:text-[var(--lagoon-deep)] hover:underline"
          >
            {event.VenueName}
          </Link>
        ) : (
          event.VenueName
        )}
      </p>
      {event.Address && (
        <p className="text-sm text-[var(--sea-ink-soft)]">
          {event.Address}
          {event.City && `, ${event.City}`}
          {event.State && ` ${event.State}`}
          {event.Zip && ` ${event.Zip}`}
        </p>
      )}
    </div>
  )
}

function EventDetailPage() {
  const { eventId } = Route.useParams()
  const { data: event, isLoading } = useEvent(eventId)
  const { isSignedIn } = useAuth()
  const { isAdmin, isAuthor } = useUserRole()
  const navigate = useNavigate()
  const deleteEvent = useDeleteEvent()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { data: backendUser } = useUser()

  if (isLoading) {
    return (
      <div className="py-12 text-center text-[var(--sea-ink-soft)]">Loading event...</div>
    )
  }

  if (!event) {
    return (
      <div className="py-12 text-center text-[var(--sea-ink-soft)]">Event not found.</div>
    )
  }

  const canEdit =
    isSignedIn &&
    (isAdmin || (isAuthor && event.SubmittedBy && backendUser?.ID === event.SubmittedBy))

  const handleDelete = async () => {
    await deleteEvent.mutateAsync(event.ID)
    navigate({ to: '/events' })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <Link
        to="/events"
        className="text-sm text-[var(--lagoon-deep)] hover:text-[var(--lagoon)]"
      >
        &larr; Back to events
      </Link>

      <div className="flex items-start justify-between">
        <div>
          {event.Category && (
            <span className="inline-block rounded-full bg-[rgba(79,184,178,0.14)] px-3 py-1 text-sm font-medium text-[var(--lagoon-deep)]">
              {event.Category}
            </span>
          )}
          <h1 className="mt-2 text-3xl font-bold text-[var(--sea-ink)]">
            {event.Title}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <SaveButton eventId={event.ID} />
          {canEdit && (
            <>
              <Link
                to="/events/$eventId/edit"
                params={{ eventId: event.ID }}
                className="text-nowrap rounded-md bg-blue-600 px-3 py-1.5 hover:bg-blue-700"
              >
                <span className='text-sm font-medium text-white'>Edit</span>
              </Link>
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-nowrap cursor-pointer rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                >
                  Delete
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleteEvent.isPending}
                    className="rounded-md text-nowrap bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleteEvent.isPending ? 'Deleting...' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="rounded-md text-nowrap border border-[var(--line)] px-3 py-1.5 text-sm font-medium text-[var(--sea-ink)] hover:bg-[var(--surface)]"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {event.ImageUrl && (
            <img
              src={event.ImageUrl}
              alt={event.Title}
              loading="lazy"
              decoding="async"
              className="w-full rounded-lg object-cover"
            />
          )}

          <div>
            <h2 className="text-lg font-semibold text-[var(--sea-ink)]">About</h2>
            {event.Description ? (
              <p className="mt-1 text-[var(--sea-ink-soft)]">{event.Description}</p>
            ) : (
              <p className="mt-1 text-[var(--sea-ink-soft)]">No description found for this event :(</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-4">
            <div>
              <h3 className="text-sm font-medium text-[var(--sea-ink-soft)]">When</h3>
              <p className="text-[var(--sea-ink)]">{formatDate(event.StartTime)}</p>
              {event.EndTime && (
                <p className="text-sm text-[var(--sea-ink-soft)]">
                  Until {formatDate(event.EndTime)}
                </p>
              )}
            </div>

            {event.VenueName && (
              <div>
                <h3 className="text-sm font-medium text-[var(--sea-ink-soft)]">Where</h3>
                <VenueName event={event} />
              </div>
            )}

            {(event.PriceMin != null || event.PriceMax != null) && (
              <div>
                <h3 className="text-sm font-medium text-[var(--sea-ink-soft)]">Price</h3>
                <p className="text-[var(--sea-ink)]">
                  {(() => {
                    const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
                    if (event.PriceMin != null && event.PriceMax != null)
                      return event.PriceMin === event.PriceMax
                        ? fmt.format(event.PriceMin)
                        : `${fmt.format(event.PriceMin)} - ${fmt.format(event.PriceMax)}`;
                    return fmt.format((event.PriceMin ?? event.PriceMax)!);
                  })()}
                </p>
              </div>
            )}

            {event.TicketUrl && (
              <a
                href={event.TicketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-md bg-blue-600 px-4 py-2 hover:bg-blue-700"
              >
                <span className='text-sm font-medium text-white'>Get Tickets</span>
              </a>
            )}
          </div>

          <EventMap
            events={[event]}
            center={{ lat: event.Latitude, lng: event.Longitude }}
            zoom={14}
            className="h-64 w-full rounded-lg"
          />
        </div>
      </div>
    </div>
  )
}
