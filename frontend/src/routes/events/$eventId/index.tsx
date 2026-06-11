import { SignUpButton, useAuth } from "@clerk/clerk-react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ApiError } from "#/lib/api";
import { AddToCalendarButton } from "#/components/AddToCalendarButton";
import { FeaturedBadge } from "#/components/events/FeaturedBadge";
import { SuggestEventEditModal } from "#/components/events/SuggestEventEditModal";
import { EventMap } from "#/components/maps/EventMap";
import { NearbyPlaces } from "#/components/places/NearbyPlaces";
import { SaveButton } from "#/components/SaveButton";
import { ShareButton } from "#/components/ShareButton";
import { Spinner } from "#/components/Spinner";
import {
  formatDateLong,
  formatTimeOnly,
  isAllDay,
  isPastEvent,
  isSameDay,
} from "#/lib/date-utils";
import {
  eventDetailOptions,
  useDeleteEvent,
  useEvent,
  useSeriesEvents,
} from "#/lib/hooks/useEvents";
import { useFeatureQuota, useSetFeatured } from "#/lib/hooks/useFeaturedEvents";
import { useUser } from "#/lib/hooks/useUser";
import { useUserRole } from "#/lib/hooks/useUserRole";
import { eventJsonLd, stripHtml, truncate } from "#/lib/seo";
import type { Event } from "#/lib/types";

export const Route = createFileRoute("/events/$eventId/")({
  ssr: false,
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData(
        eventDetailOptions(params.eventId),
      );
    } catch {
      return null;
    }
  },
  head: ({ loaderData }) => {
    const event = loaderData as Event | undefined;
    if (!event) return {};
    const description = event.Description
      ? truncate(stripHtml(event.Description), 160)
      : event.VenueName
        ? `Event at ${event.VenueName}`
        : "View event details on 919Events";
    return {
      meta: [
        { title: `${event.Title} | 919Events` },
        { name: "description", content: description },
        { property: "og:title", content: event.Title },
        { property: "og:description", content: description },
        { property: "og:type", content: "event" },
        ...(event.ImageUrl
          ? [
              { property: "og:image", content: event.ImageUrl },
              { name: "twitter:card", content: "summary_large_image" },
              { name: "twitter:image", content: event.ImageUrl },
            ]
          : []),
        { name: "twitter:title", content: event.Title },
        { name: "twitter:description", content: description },
      ],
      links: [
        { rel: "canonical", href: `https://919events.com/events/${event.ID}` },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(eventJsonLd(event)),
        },
      ],
    };
  },
  component: EventDetailPage,
});

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
  );
}

function EventDetailPage() {
  const { eventId } = Route.useParams();
  const { data: event, isLoading } = useEvent(eventId);
  const { isSignedIn, has } = useAuth();
  const { isAdmin, isAuthor } = useUserRole();
  const router = useRouter();
  const deleteEvent = useDeleteEvent();
  const setFeatured = useSetFeatured();
  // Featuring is unlocked by the paid `feature_events` entitlement (admins
  // exempt) and is open to any signed-in subscriber on any event.
  const hasFeatureEntitlement =
    isAdmin || (typeof has === "function" && has({ feature: "feature_events" }));
  const canFeatureAction = isSignedIn === true && hasFeatureEntitlement;
  const { data: featureQuota } = useFeatureQuota(canFeatureAction);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSuggestEdit, setShowSuggestEdit] = useState(false);
  const [showFeatureLimit, setShowFeatureLimit] = useState(false);
  const [showSubscribeCTA, setShowSubscribeCTA] = useState(false);
  const [showSignUpCTA, setShowSignUpCTA] = useState(false);
  const { data: backendUser } = useUser();
  const { data: seriesEvents } = useSeriesEvents(event?.SeriesID);
  const [showAllSeriesDates, setShowAllSeriesDates] = useState(false);

  if (isLoading) {
    return <Spinner className="py-12" />;
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-6xl font-bold text-(--lagoon-deep)">404</h1>
        <p className="mt-4 text-lg text-(--sea-ink)">
          This event doesn't exist or has already passed.
        </p>
        <p className="mt-2 text-sm text-(--sea-ink-soft)">
          Past events are removed automatically, so links from older digests may
          no longer work.
        </p>
        <Link
          to="/events"
          className="mt-6 inline-block rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-semibold text-white! no-underline shadow-sm hover:bg-(--lagoon)"
        >
          Browse Upcoming Events
        </Link>
      </div>
    );
  }

  const canEdit =
    isSignedIn &&
    (isAdmin ||
      (isAuthor && event.SubmittedBy && backendUser?.ID === event.SubmittedBy));

  // The Feature button shows to everyone as a funnel. Any signed-in subscriber
  // can feature any event; non-subscribers/visitors are routed to a subscribe or
  // sign-up CTA. Only the user who featured an event (or an admin) can un-feature
  // it. The subscription + monthly cap are enforced server-side.
  const featuredByMe =
    isAdmin || (!!event.FeaturedBy && backendUser?.ID === event.FeaturedBy);


  const handleFeatureClick = () => {
    if (event.IsFeatured) {
      // Already featured: only the featurer (or an admin) can turn it off.
      if (featuredByMe) {
        setFeatured.mutate({ id: event.ID, featured: false },);
      }
      return;
    }
    if (!isSignedIn) {
      setShowSignUpCTA(true);
      return;
    }
    // Let the server decide why a signed-in user can't feature, so the correct
    // message shows: 402 → not subscribed (subscribe CTA); 403 → over the
    // monthly cap (limit popup). Relying on the client's entitlement view here
    // would mis-route subscribers who are actually just at their limit.
    setFeatured.mutate(
      { id: event.ID, featured: true },
      {
        onError: (err) => {
          if (err instanceof ApiError) {
            if (err.message.includes("feature_limit_reached")) {
              setShowFeatureLimit(true);
            } else if (err.message.includes("subscription_required")) {
              setShowSubscribeCTA(true);
            }
          }
        },
      },
    );
  };

  const handleDelete = async () => {
    await deleteEvent.mutateAsync(event.ID);
    router.history.back();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => router.history.back()}
        className="cursor-pointer text-sm text-(--lagoon-deep) hover:text-(--lagoon)"
      >
        &larr; Back
      </button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {event.IsFeatured && <FeaturedBadge className="mb-2" />}
          {event.Categories && event.Categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {event.Categories.map((cat) => (
                <span
                  key={cat}
                  className="inline-block rounded-full bg-[rgba(79,184,178,0.14)] px-3 py-1 text-sm font-medium text-(--lagoon-deep)"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}
          <h1 className="mt-2 text-3xl font-bold text-(--sea-ink)">
            {event.Title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveButton eventId={event.ID} disabled={isPastEvent(event)} />
          <AddToCalendarButton event={event} />
          <ShareButton event={event} />
          {!canEdit && !isPastEvent(event) && (
            <button
              type="button"
              onClick={() => setShowSuggestEdit(true)}
              className="text-nowrap cursor-pointer rounded-md border border-(--line) bg-(--surface-strong) px-3 py-1.5 text-sm font-medium text-(--sea-ink) hover:bg-(--surface)"
            >
              Suggest Edit
            </button>
          )}
          {!isPastEvent(event) && (
            <button
              type="button"
              onClick={handleFeatureClick}
              disabled={setFeatured.isPending || (event.IsFeatured && !featuredByMe)}
              className={`text-nowrap cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                event.IsFeatured
                  ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                  : "border border-(--line) bg-(--surface-strong) text-(--sea-ink) hover:bg-(--surface)"
              }`}
            >
              {event.IsFeatured
                ? featuredByMe
                  ? "★ Featured — Unfeature"
                  : "★ Featured"
                : "★ Feature"}
            </button>
          )}
          {canFeatureAction && featureQuota && !featureQuota.unlimited && (
            <p className="w-half text-right text-xs text-(--sea-ink-soft)">
              {featureQuota.remaining > 0
                ? `${featureQuota.remaining} of ${featureQuota.limit} features left this month`
                : `Monthly feature limit reached (${featureQuota.limit}/month)`}
            </p>
          )}
          {canEdit && (
            <>
              <Link
                to="/submit"
                search={{ from: event.ID }}
                className="text-nowrap rounded-md border border-(--line) bg-(--surface-strong) px-3 py-1.5 hover:bg-(--surface)"
              >
                <span className="text-sm font-medium text-(--sea-ink)">
                  Copy
                </span>
              </Link>
              <Link
                to="/events/$eventId/edit"
                params={{ eventId: event.ID }}
                className="text-nowrap rounded-md bg-blue-600 px-3 py-1.5 hover:bg-blue-700"
              >
                <span className="text-sm font-medium text-white">Edit</span>
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
                    {deleteEvent.isPending ? "Deleting..." : "Confirm"}
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

      {isPastEvent(event) && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-800">
            This event has already occurred.
          </p>
        </div>
      )}

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
              <div
                className="prose mt-1 max-w-none text-(--sea-ink-soft)"
                dangerouslySetInnerHTML={{ __html: event.Description }}
              />
            ) : (
              <p className="mt-1 text-(--sea-ink-soft)">
                No description found for this event :(
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border border-(--line) bg-(--surface-strong) p-4">
            <div>
              <h3 className="text-sm font-medium text-(--sea-ink-soft)">
                When
              </h3>
              {isAllDay(event) ? (
                <p className="text-(--sea-ink)">
                  {new Date(event.StartTime).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}{" "}
                  · All Day
                </p>
              ) : (
                <>
                  {event.EndTime &&
                  isSameDay(event.StartTime, event.EndTime) ? (
                    <p className="text-(--sea-ink)">
                      {formatDateLong(event.StartTime)} –{" "}
                      {formatTimeOnly(event.EndTime)}
                    </p>
                  ) : (
                    <>
                      <p className="text-(--sea-ink)">
                        {formatDateLong(event.StartTime)}
                      </p>
                      {event.EndTime && (
                        <p className="text-sm text-(--sea-ink-soft)">
                          Until {formatDateLong(event.EndTime)}
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {seriesEvents &&
              seriesEvents.length > 1 &&
              (() => {
                const otherDates = seriesEvents.filter(
                  (e) => e.ID !== event.ID,
                );
                const collapsedLimit = 6;
                const visibleDates = showAllSeriesDates
                  ? otherDates
                  : otherDates.slice(0, collapsedLimit);
                const hiddenCount = otherDates.length - collapsedLimit;
                return (
                  <div>
                    <h3 className="text-sm font-medium text-(--sea-ink-soft)">
                      Other Dates in This Series
                    </h3>
                    <div className="mt-1 space-y-1">
                      {visibleDates.map((e) => (
                        <Link
                          key={e.ID}
                          to="/events/$eventId"
                          params={{ eventId: e.ID }}
                          className="block text-sm text-(--lagoon-deep) hover:underline"
                        >
                          {formatDateLong(e.StartTime)}
                        </Link>
                      ))}
                      {hiddenCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowAllSeriesDates((v) => !v)}
                          className="cursor-pointer text-sm text-(--lagoon-deep) hover:underline"
                        >
                          {showAllSeriesDates
                            ? "Show less"
                            : `and ${hiddenCount} more`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

            {event.VenueName && (
              <div>
                <h3 className="text-sm font-medium text-(--sea-ink-soft)">
                  Where
                </h3>
                <VenueName event={event} />
              </div>
            )}

            {(event.PriceMin != null ||
              event.PriceMax != null ||
              event.IsFree) && (
              <div>
                <h3 className="text-sm font-medium text-(--sea-ink-soft)">
                  Price
                </h3>
                <p className="text-(--sea-ink)">
                  {(() => {
                    const fmt = new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    });
                    if (event.PriceMin == null && event.PriceMax == null)
                      return "Free";
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
                <span className="text-sm font-medium text-white">
                  Get Tickets
                </span>
              </a>
            )}
          </div>

          <EventMap
            events={[event]}
            center={{ lat: event.Latitude, lng: event.Longitude }}
            zoom={14}
            className="h-64 w-full rounded-lg"
          />

          {/* <NearbyPlaces lat={event.Latitude} lng={event.Longitude} /> */}
        </div>
      </div>

      {showSuggestEdit && event && (
        <SuggestEventEditModal
          event={event}
          onClose={() => setShowSuggestEdit(false)}
        />
      )}

      {showFeatureLimit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-lg border border-(--line) bg-(--surface-strong) p-6 text-center shadow-xl">
            <p className="text-lg font-semibold text-(--sea-ink)">
              You've used all your features this month
            </p>
            <p className="mt-1 text-sm text-(--sea-ink-soft)">
              Your plan includes {featureQuota?.limit ?? 3} featured events per
              calendar month, and you've used them all. Un-feature one of your
              events, or wait until next month to feature this one.
            </p>
            <button
              type="button"
              onClick={() => setShowFeatureLimit(false)}
              className="mt-4 cursor-pointer rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-semibold text-white hover:bg-(--lagoon)"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {showSubscribeCTA && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-lg border border-(--line) bg-(--surface-strong) p-6 text-center shadow-xl">
            <p className="text-lg font-semibold text-(--sea-ink)">
              Feature your events
            </p>
            <p className="mt-1 text-sm text-(--sea-ink-soft)">
              Featuring highlights your events across 919Events — on the home
              page, in listings, and on the map. Subscribe to feature up to 3 of
              your events each month.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link
                to="/donate"
                className="rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-semibold text-white! no-underline hover:bg-(--lagoon)"
              >
                Subscribe
              </Link>
              <button
                type="button"
                onClick={() => setShowSubscribeCTA(false)}
                className="cursor-pointer rounded-md border border-(--line) px-4 py-2 text-sm font-semibold text-(--sea-ink) hover:bg-(--surface)"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}

      {showSignUpCTA && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-lg border border-(--line) bg-(--surface-strong) p-6 text-center shadow-xl">
            <p className="text-lg font-semibold text-(--sea-ink)">
              Feature your events
            </p>
            <p className="mt-1 text-sm text-(--sea-ink-soft)">
              Create an account and subscribe to feature your events across
              919Events and reach more people.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <SignUpButton mode="modal">
                <button
                  type="button"
                  className="cursor-pointer rounded-md bg-(--lagoon-deep) px-4 py-2 text-sm font-semibold text-white hover:bg-(--lagoon)"
                >
                  Sign up
                </button>
              </SignUpButton>
              <button
                type="button"
                onClick={() => setShowSignUpCTA(false)}
                className="cursor-pointer rounded-md border border-(--line) px-4 py-2 text-sm font-semibold text-(--sea-ink) hover:bg-(--surface)"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
