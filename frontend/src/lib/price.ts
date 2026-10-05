import type { Event } from "#/lib/types";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// Returns a display price, "Free" only when the event is explicitly free, or
// null when the price is unknown (no price data and not tagged free).
export function formatPrice(event: Event): string | null {
  const { PriceMin: min, PriceMax: max } = event;
  if (min != null && max != null) {
    return min === max ? usd.format(min) : `${usd.format(min)} - ${usd.format(max)}`;
  }
  const single = min ?? max;
  if (single != null) return usd.format(single);
  if (event.IsFree) return "Free";
  return null;
}
