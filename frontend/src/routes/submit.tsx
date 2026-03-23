import { createFileRoute } from '@tanstack/react-router'
import { RoleProtectedRoute } from '#/components/RoleProtectedRoute'
import { EventForm } from '#/components/EventForm'
import { eventDetailOptions, useEvent } from '#/lib/hooks/useEvents'

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

  return (
    <RoleProtectedRoute roles={['author', 'admin']}>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-bold text-(--sea-ink)">
          Submit an Event
        </h1>
        <div className="rounded-lg border border-(--line) bg-(--surface-strong) p-6">
          <EventForm initialValues={initialValues} />
        </div>
      </div>
    </RoleProtectedRoute>
  )
}
