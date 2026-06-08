import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import type { Event } from "#/lib/types";
import { formatEventTime } from "#/lib/date-utils";

gsap.registerPlugin(ScrollTrigger);

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// Returns a display price, "Free" only when the event is explicitly free, or
// null when the price is unknown (no price data and not tagged free).
function formatPrice(event: Event): string | null {
  if (event.PriceMin != null || event.PriceMax != null) {
    if (event.PriceMin != null && event.PriceMax != null) {
      if (event.PriceMin === event.PriceMax) return usd.format(event.PriceMin);
      return `${usd.format(event.PriceMin)} - ${usd.format(event.PriceMax)}`;
    }
    return usd.format((event.PriceMin ?? event.PriceMax)!);
  }
  if (event.IsFree) return "Free";
  return null;
}

export function EventCard({
  event,
  animateOnScroll = true,
}: {
  event: Event;
  animateOnScroll?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!animateOnScroll || !cardRef.current) return;
    gsap.fromTo(
      cardRef.current,
      { y: 40, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.6,
        ease: "power3.out",
        force3D: true,
        scrollTrigger: {
          trigger: cardRef.current,
          start: "top 92%",
          toggleActions: "play none none none",
        },
      },
    );
  }, { scope: cardRef, dependencies: [animateOnScroll] });

  return (
    <div ref={cardRef} style={animateOnScroll ? { opacity: 0 } : undefined}>
    <Link
      to="/events/$eventId"
      params={{ eventId: event.ID }}
      className="block rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-4 shadow-sm transition hover:shadow-md"
    >
      {event.ImageUrl && (
        <img
          src={event.ImageUrl}
          alt={event.Title}
          loading="lazy"
          decoding="async"
          className="mb-3 h-40 w-full rounded-md object-cover"
        />
      )}
      <div className="space-y-1">
        {event.Categories && event.Categories.length > 0 && (
          <span className="inline-block rounded-full bg-[rgba(79,184,178,0.14)] px-2 py-0.5 text-xs font-medium text-[var(--lagoon-deep)]">
            {event.Categories[0]}{event.Categories.length > 1 && ` +${event.Categories.length - 1}`}
          </span>
        )}
        <h3 className="font-semibold text-[var(--sea-ink)]">{event.Title}</h3>
        <p className="text-sm text-[var(--sea-ink-soft)]">
          {formatEventTime(event)}
        </p>
        {event.VenueName && (
          <p className="text-sm text-[var(--sea-ink-soft)]">
            {event.VenueID ? (
              <Link
                to="/venues/$venueId"
                params={{ venueId: event.VenueID }}
                className="hover:text-[var(--lagoon-deep)] hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {event.VenueName}
              </Link>
            ) : (
              event.VenueName
            )}
          </p>
        )}
        {(() => {
          const price = formatPrice(event);
          return price == null ? null : (
            <p className="text-sm font-medium text-[var(--sea-ink)]">{price}</p>
          );
        })()}
      </div>
    </Link>
    </div>
  );
}
