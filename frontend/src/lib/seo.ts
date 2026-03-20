import type { Event, Venue } from './types'

const SITE_URL = 'https://919events.com'

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1).trimEnd() + '\u2026'
}

export function eventJsonLd(event: Event): object {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.Title,
    startDate: event.StartTime,
    url: `${SITE_URL}/events/${event.ID}`,
  }

  if (event.EndTime) ld.endDate = event.EndTime
  if (event.Description) ld.description = truncate(stripHtml(event.Description), 300)
  if (event.ImageUrl) ld.image = event.ImageUrl

  if (event.VenueName) {
    const place: Record<string, unknown> = {
      '@type': 'Place',
      name: event.VenueName,
      geo: {
        '@type': 'GeoCoordinates',
        latitude: event.Latitude,
        longitude: event.Longitude,
      },
    }
    if (event.Address) {
      place.address = {
        '@type': 'PostalAddress',
        streetAddress: event.Address,
        addressLocality: event.City,
        addressRegion: event.State,
        postalCode: event.Zip,
      }
    }
    ld.location = place
  }

  if (event.PriceMin != null || event.PriceMax != null) {
    const offer: Record<string, unknown> = {
      '@type': 'Offer',
      priceCurrency: 'USD',
    }
    if (event.PriceMin != null && event.PriceMax != null && event.PriceMin !== event.PriceMax) {
      offer.lowPrice = event.PriceMin
      offer.highPrice = event.PriceMax
    } else {
      offer.price = event.PriceMin ?? event.PriceMax
    }
    if (event.TicketUrl) offer.url = event.TicketUrl
    ld.offers = offer
  }

  return ld
}

export function venueJsonLd(venue: Venue): object {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: venue.VenueName,
    url: `${SITE_URL}/venues/${venue.ID}`,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: venue.Latitude,
      longitude: venue.Longitude,
    },
  }

  if (venue.Description) ld.description = venue.Description

  if (venue.Address) {
    ld.address = {
      '@type': 'PostalAddress',
      streetAddress: venue.Address,
      addressLocality: venue.City,
      addressRegion: venue.State,
      postalCode: venue.Zip,
    }
  }

  if (venue.Hours) ld.openingHours = venue.Hours

  return ld
}
