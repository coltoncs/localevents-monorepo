import { createFileRoute } from '@tanstack/react-router'
import { EventForm } from '#/components/events/EventForm'
import { eventDetailOptions, useEvent } from '#/lib/hooks/useEvents'
import { useUserRole } from '#/lib/hooks/useUserRole'

interface SubmitSearch {
  from?: string
}

export const Route = createFileRoute('/submit')({
  validateSearch: (search: Record<string, unknown>): SubmitSearch => ({
    from: typeof search.from === 'string' ? search.from : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    if (deps.from) {
      await context.queryClient.prefetchQuery(eventDetailOptions(deps.from))
    }
  },
  component: SubmitPage,
})

function SubmitPage() {
  const { from } = Route.useSearch()
  const { data: sourceEvent } = useEvent(from ?? '')
  const { canCreateEvent, isLoaded } = useUserRole()

  const initialValues = sourceEvent && from
    ? {
        title: sourceEvent.Title,
        description: sourceEvent.Description,
        venue_name: sourceEvent.VenueName,
        venue_id: sourceEvent.VenueID,
        address: sourceEvent.Address,
        city: sourceEvent.City,
        state: sourceEvent.State,
        zip: sourceEvent.Zip,
        latitude: sourceEvent.Latitude,
        longitude: sourceEvent.Longitude,
        categories: sourceEvent.Categories,
        image_url: sourceEvent.ImageUrl,
        ticket_url: sourceEvent.TicketUrl,
        price_min: sourceEvent.PriceMin,
        price_max: sourceEvent.PriceMax,
      }
    : undefined

  if (!isLoaded) {
    return (
      <div className="py-12 text-center text-(--sea-ink-soft)">Loading...</div>
    )
  }

  const mode = canCreateEvent ? 'create' : 'suggest'

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1
        className={`text-2xl font-bold text-(--sea-ink) ${mode === 'suggest' ? 'mb-2' : 'mb-6'}`}
      >
        {mode === 'create' ? 'Submit an Event' : 'Suggest an Event'}
      </h1>
      {mode === 'suggest' && (
        <p className="mb-6 text-sm text-(--sea-ink-soft)">
          Anyone can suggest an event. An admin will review your submission
          before it's published.
        </p>
      )}
      <div className="rounded-lg border border-(--line) bg-(--surface-strong) p-6">
        <EventForm initialValues={initialValues} mode={mode} />
      </div>
    </div>
  )
}
