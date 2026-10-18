// Search and link-preview metadata for event pages.
import { toInstant } from './ics.mjs';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

// schema.org wants an offset on date-times; a bare local time is Dehradun time.
const schemaDate = (value) => (DATE_ONLY.test(value) || HAS_ZONE.test(value) ? value : `${value}+05:30`);

const clip = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`);

/** schema.org Event for Google's event rich results. */
export function eventJsonLd(e, { pageUrl, imageUrl }) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.title,
    startDate: schemaDate(e.startAt),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: e.venue.name,
      address: {
        '@type': 'PostalAddress',
        // Many sources only give "Dehradun" as the address, which is the locality, not a street.
        ...(e.venue.address && e.venue.address.trim().toLowerCase() !== 'dehradun' ? { streetAddress: e.venue.address } : {}),
        addressLocality: 'Dehradun',
        addressRegion: 'Uttarakhand',
        addressCountry: 'IN'
      }
    },
    image: [imageUrl],
    url: pageUrl
  };
  if (e.endAt) ld.endDate = schemaDate(e.endAt);
  if (e.description) ld.description = e.description;
  const sourceUrl = e.sources?.[0]?.url;
  if (e.pricing?.type === 'free') {
    ld.isAccessibleForFree = true;
    ld.offers = { '@type': 'Offer', price: 0, priceCurrency: 'INR', ...(sourceUrl ? { url: sourceUrl } : {}) };
  } else if (e.pricing?.minPrice) {
    ld.offers = { '@type': 'Offer', price: e.pricing.minPrice, priceCurrency: 'INR', ...(sourceUrl ? { url: sourceUrl } : {}) };
  }
  return ld;
}

/** One-line summary used as the page and link-preview description. */
export function eventSummary(e) {
  const dateOnly = DATE_ONLY.test(e.startAt);
  const when = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', ...(dateOnly ? {} : { hour: 'numeric', minute: '2-digit', hour12: true }), timeZone: 'Asia/Kolkata'
  }).format(dateOnly ? new Date(`${e.startAt}T12:00:00+05:30`) : toInstant(e.startAt));
  const price = e.pricing?.type === 'free' ? 'Free' : e.pricing?.minPrice ? `From ₹${e.pricing.minPrice}` : '';
  const head = [`${when} at ${e.venue.name}`, e.venue.area, 'Dehradun'].filter(Boolean).join(', ');
  const base = price ? `${head}. ${price}.` : `${head}.`;
  return e.description ? clip(`${base} ${e.description}`, 200) : base;
}
