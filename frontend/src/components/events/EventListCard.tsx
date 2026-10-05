import { MapPin } from "lucide-react";
import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import type { Event } from "#/lib/types";
import { formatEventTime } from "#/lib/date-utils";
import { formatPrice } from "#/lib/price";
import { FeaturedBadge } from "#/components/events/FeaturedBadge";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

// Static raster from the Mapbox Static Images API, centered on the event so the
// pin can sit at the image's center regardless of how object-cover crops it.
// Attribution is turned off here and rendered once below the list instead.
function staticMapUrl(style: "light-v11" | "dark-v11", lng: number, lat: number) {
  return `https://api.mapbox.com/styles/v1/mapbox/${style}/static/${lng},${lat},14/640x200@2x?attribution=false&logo=false&access_token=${MAPBOX_TOKEN}`;
}

// Decorative map snippet. On desktop it fills the card's right half, faded in
// from the middle. On mobile it covers the whole card but stays faint behind
// the text; the image is 170% of the card's width and anchored left, so its
// center (the event) lands near the right edge instead of behind the title.
// One <img> per theme; the hidden one is display:none, so with lazy loading
// the browser never fetches it.
const mapImgClass =
  "absolute inset-y-0 left-0 h-full w-[170%] max-w-none object-cover sm:w-full";

function CardMap({ lat, lng }: { lat: number; lng: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg [mask-image:linear-gradient(to_right,rgb(0_0_0/0.2),rgb(0_0_0/0.35)_55%,black_85%)] sm:left-1/2 sm:rounded-l-none sm:[mask-image:linear-gradient(to_right,transparent,black_45%)]"
    >
      <img
        src={staticMapUrl("light-v11", lng, lat)}
        alt=""
        loading="lazy"
        decoding="async"
        className={`${mapImgClass} opacity-70 dark:hidden`}
      />
      <img
        src={staticMapUrl("dark-v11", lng, lat)}
        alt=""
        loading="lazy"
        decoding="async"
        className={`${mapImgClass} hidden opacity-80 dark:block`}
      />
      <MapPin
        size={26}
        strokeWidth={1.75}
        className="absolute left-[85%] top-1/2 -translate-x-1/2 -translate-y-full fill-(--lagoon) text-(--surface-strong) drop-shadow sm:left-1/2"
      />
    </div>
  );
}

function hasCoords(event: Event) {
  return Boolean(MAPBOX_TOKEN && event.Latitude && event.Longitude);
}

gsap.registerPlugin(ScrollTrigger);

// Horizontal event card for list views. The title link is stretched over the
// whole card (after:inset-0) so the card is clickable without nesting the
// venue link inside another <a>.
export function EventListCard({ event }: { event: Event }) {
  const price = formatPrice(event);
  const category = event.Categories?.[0];
  const extraCategories = (event.Categories?.length ?? 0) - 1;

  return (
    <article
      className={`relative flex gap-3 rounded-lg border p-3 shadow-sm transition hover:shadow-md sm:gap-4 ${
        event.IsFeatured
          ? "border-amber-400/40 bg-amber-400/10 hover:bg-amber-400/15"
          : "border-(--line) bg-(--surface-strong)"
      }`}
    >
      {hasCoords(event) && <CardMap lat={event.Latitude} lng={event.Longitude} />}
      {event.ImageUrl ? (
        <img
          src={event.ImageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="relative h-24 w-24 shrink-0 rounded-md border border-(--line) object-cover sm:h-28 sm:w-40"
        />
      ) : (
        <div
          className="relative h-24 w-24 shrink-0 rounded-md border border-(--line) sm:h-28 sm:w-40"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--lagoon) 40%, transparent), color-mix(in oklab, var(--palm) 40%, transparent))",
          }}
        />
      )}

      <div className="relative flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {event.IsFeatured && <FeaturedBadge />}
            {category && (
              <span className="truncate rounded-full border border-(--chip-line) bg-(--chip-bg) px-2 py-0.5 font-mono text-[0.6rem] font-medium uppercase tracking-wider text-(--lagoon-deep)">
                {category}
                {extraCategories > 0 && ` +${extraCategories}`}
              </span>
            )}
          </div>
          {price != null && (
            <span className="shrink-0 rounded-md bg-(--surface-strong)/85 px-1.5 py-0.5 text-sm font-semibold text-green-500 backdrop-blur-sm">
              {price}
            </span>
          )}
        </div>

        <h3 className="line-clamp-2 font-semibold text-(--sea-ink)">
          <Link
            to="/events/$eventId"
            params={{ eventId: event.ID }}
            className="rounded-lg after:absolute after:inset-0 hover:text-(--lagoon-deep)"
          >
            {event.Title}
          </Link>
        </h3>

        <p className="text-sm text-(--sea-ink-soft)">{formatEventTime(event)}</p>

        {(event.VenueName || event.City) && (
          <p className="truncate text-sm text-(--sea-ink-soft)">
            {event.VenueName &&
              (event.VenueID ? (
                <Link
                  to="/venues/$venueId"
                  params={{ venueId: event.VenueID }}
                  className="relative z-10 hover:text-(--lagoon-deep) hover:underline"
                >
                  {event.VenueName}
                </Link>
              ) : (
                event.VenueName
              ))}
            {event.VenueName && event.City && " · "}
            {event.City && (
              <>
                {event.City}
                {event.State ? `, ${event.State}` : ""}
              </>
            )}
          </p>
        )}
      </div>
    </article>
  );
}

export function EventCardList({ events }: { events: Event[] }) {
  const listRef = useRef<HTMLUListElement>(null);

  useGSAP(
    () => {
      const items = gsap.utils.toArray<HTMLElement>("[data-reveal]");
      if (items.length === 0) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        ScrollTrigger.batch(items, {
          start: "top 95%",
          onEnter: (els) =>
            gsap.to(els, {
              y: 0,
              opacity: 1,
              stagger: 0.06,
              duration: 0.5,
              ease: "power3.out",
              force3D: true,
              clearProps: "transform",
            }),
        });
      });
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(items, { y: 0, opacity: 1, clearProps: "transform" });
      });
    },
    { scope: listRef, dependencies: [events] },
  );

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-(--line) bg-(--surface-strong) px-4 py-8 text-center text-sm text-(--sea-ink-soft)">
        No events found
      </div>
    );
  }

  return (
    <div>
    <ul ref={listRef} className="space-y-3">
      {events.map((event) => (
        <li
          key={event.ID}
          data-reveal
          style={{ opacity: 0, transform: "translateY(16px)" }}
        >
          <EventListCard event={event} />
        </li>
      ))}
    </ul>
    {MAPBOX_TOKEN && (
      <p className="mt-2 text-right text-[0.65rem] text-(--sea-ink-soft)">
        Maps ©{" "}
        <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noreferrer" className="hover:underline">
          Mapbox
        </a>{" "}
        ©{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="hover:underline">
          OpenStreetMap
        </a>
      </p>
    )}
    </div>
  );
}
