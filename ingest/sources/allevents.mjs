import { fetchText } from '../lib/http.mjs';
import { eventLikeObjects, flattenObjects } from '../lib/jsonld.mjs';
import { stableId, slugify, priceFromOffers, priceFromText, categoryFromText, isLikelyDehradunEvent, stripHtml, nowIso, sleep } from '../lib/utils.mjs';

const LIST = 'https://allevents.in/dehradun';
// The city listing rarely carries prices; each event's own page does. Fetched one at a time, and capped.
const MAX_PRICE_PAGES = 25;
const PRICE_PAGE_DELAY_MS = 700;

function toEvent(o, url = LIST) {
  const loc = o.location || o.venue || {};
  const addr = typeof loc.address === 'string'
    ? loc.address
    : [loc.address?.streetAddress, loc.address?.addressLocality].filter(Boolean).join(' ');
  const title = stripHtml(o.name || o.title || '');
  const description = stripHtml(o.description || '');
  const start = o.startDate || o.start_time || o.startAt;
  const venueName = stripHtml(loc.name || o.locationName || 'Venue TBA');

  if (!title || !start || !isLikelyDehradunEvent({
    title,
    description,
    venueName,
    address: stripHtml(addr || ''),
    city: o.city || loc.address?.addressLocality || ''
  })) return null;

  const checkedAt = nowIso();
  const text = [title, description, venueName, addr, o.city].filter(Boolean).join(' ');

  return {
    id: stableId('allevents', o.url || o.id || title, start),
    slug: slugify(title),
    title,
    description,
    startAt: start,
    endAt: o.endDate || o.end_at,
    venue: { name: venueName, address: stripHtml(addr || ''), city: 'Dehradun' },
    categories: categoryFromText(text),
    pricing: priceFromOffers(o.offers) || priceFromText(`${title} ${description}`),
    sources: [{ provider: 'allevents', url: o.url || url, externalId: String(o.id || '') || undefined, checkedAt, confidence: 0.75 }],
    verificationStatus: 'review',
    curation: { status: 'published', score: 4 },
    firstSeenAt: checkedAt,
    lastSeenAt: checkedAt,
    lastCheckedAt: checkedAt
  };
}

/** The price from an event's own AllEvents page, or null when the page gives none or can't be read. */
export async function priceFromEventPage(url, fetchPage = fetchText) {
  try {
    const objects = [...eventLikeObjects(await fetchPage(url))];
    for (const o of objects) {
      const price = priceFromOffers(o.offers);
      if (price) return price;
    }
  } catch {}
  return null;
}

/** Fills in prices the listing didn't give, from each event's own page. */
export async function addPricesFromEventPages(events, { fetchPage = fetchText, delayMs = PRICE_PAGE_DELAY_MS, max = MAX_PRICE_PAGES } = {}) {
  const missing = events.filter((e) => e.pricing.type === 'unknown' && /^https:\/\/allevents\.in\//.test(e.sources[0]?.url || '')).slice(0, max);
  let found = 0;
  for (const [i, e] of missing.entries()) {
    if (i > 0 && delayMs) await sleep(delayMs);
    const price = await priceFromEventPage(e.sources[0].url, fetchPage);
    if (price) { e.pricing = price; found++; }
  }
  return { pricePagesFetched: missing.length, pricesFound: found };
}

export async function fetchAllEvents({ fetchPage = fetchText, delayMs } = {}) {
  const html = await fetchPage(LIST);
  const candidates = [...eventLikeObjects(html)];
  const next = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (next) {
    try { candidates.push(...flattenObjects(JSON.parse(next[1]))); } catch {}
  }
  const events = [];
  const seen = new Set();
  for (const o of candidates) {
    const e = toEvent(o);
    if (e && !seen.has(e.id)) { seen.add(e.id); events.push(e); }
  }
  const prices = await addPricesFromEventPages(events, { fetchPage, delayMs });
  return { source: 'allevents', events, diagnostics: { candidates: candidates.length, ...prices } };
}
