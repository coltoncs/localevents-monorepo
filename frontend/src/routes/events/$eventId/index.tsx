import { useState } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useAuth } from '@clerk/clerk-react'
import { useEvent, eventDetailOptions, useDeleteEvent } from '#/lib/hooks/useEvents'
import { useUserRole } from '#/lib/hooks/useUserRole'
import { EventMap } from '#/components/EventMap'
import { SaveButton } from '#/components/SaveButton'
import { useUser } from '#/lib/hooks/useUser'
import { Spinner } from '#/components/Spinner'
import { isAllDay, formatDateLong } from '#/lib/date-utils'
import { stripHtml, truncate, eventJsonLd } from '#/lib/seo'
import type { Event } from '#/lib/types'

export const Route = createFileRoute('/events/$eventId/')({
  ssr: false,
  loader: async ({ context, params }) => {
    return await context.queryClient.ensureQueryData(
      eventDetailOptions(params.eventId),
    )
  },
  head: ({ loaderData }) => {
    const event = loaderData as Event | undefined
    if (!event) return {}
    const description = event.Description
      ? truncate(stripHtml(event.Description), 160)
      : event.VenueName
        ? `Event at ${event.VenueName}`
        : 'View event details on 919Events'
    return {
      meta: [
        { title: `${event.Title} | 919Events` },
        { name: 'description', content: description },
        { property: 'og:title', content: event.Title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'event' },
        ...(event.ImageUrl
          ? [
              { property: 'og:image', content: event.ImageUrl },
              { name: 'twitter:card', content: 'summary_large_image' },
              { name: 'twitter:image', content: event.ImageUrl },
            ]
          : []),
        { name: 'twitter:title', content: event.Title },
        { name: 'twitter:description', content: description },
      ],
      links: [
        { rel: 'canonical', href: `https://919events.com/events/${event.ID}` },
      ],
      scripts: [
        {
          type: 'application/ld+json',
          children: JSON.stringify(eventJsonLd(event)),
        },
      ],
    }
  },
  component: EventDetailPage,
})

function VenueName({ event }: { event: Event }) {
  return (
    <div>
      <p className="text-(--sea-ink)">
        {event.VenueID ? (
          <Link
            to="/venues/$venueId"
            params={{ venueId: event.VenueID }}
            className="hover:text-(--lagoon-deep) hover:underline"
          >
            {event.VenueName}
          </Link>
        ) : (
          event.VenueName
        )}
      </p>
      {event.Address && (
        <p className="text-sm text-(--sea-ink-soft)">
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
  const router = useRouter()
  const deleteEvent = useDeleteEvent()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { data: backendUser } = useUser()

  if (isLoading) {
    return <Spinner className="py-12" />
  }

  if (!event) {
    return (
      <div className="py-12 text-center text-(--sea-ink-soft)">Event not found.</div>
    )
  }

  const canEdit =
    isSignedIn &&
    (isAdmin || (isAuthor && event.SubmittedBy && backendUser?.ID === event.SubmittedBy))

  const handleDelete = async () => {
    await deleteEvent.mutateAsync(event.ID)
    router.history.back()
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => router.history.back()}
        className="cursor-pointer text-sm text-(--lagoon-deep) hover:text-(--lagoon)"
      >
        &larr; Back
      </button>

      <div className="flex items-start justify-between">
        <div>
          {event.Category && (
            <span className="inline-block rounded-full bg-[rgba(79,184,178,0.14)] px-3 py-1 text-sm font-medium text-(--lagoon-deep)">
              {event.Category}
            </span>
          )}
          <h1 className="mt-2 text-3xl font-bold text-(--sea-ink)">
            {event.Title}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <SaveButton eventId={event.ID} />
          {canEdit && (
            <>
              <Link
                to="/submit"
                search={{ from: event.ID }}
                className="text-nowrap rounded-md border border-(--line) bg-(--surface-strong) px-3 py-1.5 hover:bg-(--surface)"
              >
                <span className='text-sm font-medium text-(--sea-ink)'>Copy</span>
              </Link>
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
                    className="rounded-md text-nowrap border border-(--line) px-3 py-1.5 text-sm font-medium text-(--sea-ink) hover:bg-(--surface)"
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
            <h2 className="text-lg font-semibold text-(--sea-ink)">About</h2>
            {event.Description ? (
              <div className="prose mt-1 max-w-none text-(--sea-ink-soft)" dangerouslySetInnerHTML={{ __html: event.Description }} />
            ) : (
              <p className="mt-1 text-(--sea-ink-soft)">No description found for this event :(</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border border-(--line) bg-(--surface-strong) p-4">
            <div>
              <h3 className="text-sm font-medium text-(--sea-ink-soft)">When</h3>
              {isAllDay(event) ? (
                <p className="text-(--sea-ink)">
                  {new Date(event.StartTime).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · All Day
                </p>
              ) : (
                <>
                  <p className="text-(--sea-ink)">{formatDateLong(event.StartTime)}</p>
                  {event.EndTime && (
                    <p className="text-sm text-(--sea-ink-soft)">
                      Until {formatDateLong(event.EndTime)}
                    </p>
                  )}
                </>
              )}
            </div>

            {event.VenueName && (
              <div>
                <h3 className="text-sm font-medium text-(--sea-ink-soft)">Where</h3>
                <VenueName event={event} />
              </div>
            )}

            {(event.PriceMin != null || event.PriceMax != null) && (
              <div>
                <h3 className="text-sm font-medium text-(--sea-ink-soft)">Price</h3>
                <p className="text-(--sea-ink)">
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
