import { fetchText } from '../lib/http.mjs';
import { eventLikeObjects, flattenObjects } from '../lib/jsonld.mjs';
import { stableId, slugify, parseMoney, categoryFromText, isDehradunText, stripHtml, nowIso } from '../lib/utils.mjs';

const LIST = 'https://allevents.in/dehradun';

function toEvent(o, url = LIST) {
  const loc = o.location || o.venue || {};
  const addr = typeof loc.address === 'string'
    ? loc.address
    : [loc.address?.streetAddress, loc.address?.addressLocality].filter(Boolean).join(' ');
  const title = o.name || o.title;
  const start = o.startDate || o.start_time || o.startAt;
  const text = [title, o.description, loc.name, addr, o.city].filter(Boolean).join(' ');
  if (!title || !start || !isDehradunText(text)) return null;
  const checkedAt = nowIso();
  const offers = Array.isArray(o.offers) ? o.offers[0] : o.offers;
  return {
    id: stableId('allevents', o.url || o.id || title, start),
    slug: slugify(title),
    title: stripHtml(title),
    description: stripHtml(o.description || ''),
    startAt: start,
    endAt: o.endDate || o.end_at,
    venue: { name: loc.name || o.locationName || 'Venue TBA', address: stripHtml(addr || ''), city: 'Dehradun' },
    categories: categoryFromText(text),
    pricing: offers?.price != null
      ? { type: Number(offers.price) === 0 ? 'free' : 'paid', minPrice: Number(offers.price) || undefined, currency: 'INR' }
      : parseMoney(JSON.stringify(o)),
    sources: [{ provider: 'allevents', url: o.url || url, externalId: String(o.id || '') || undefined, checkedAt, confidence: 0.75 }],
    verificationStatus: 'verified',
    curation: { status: 'published', score: 5 },
    firstSeenAt: checkedAt,
    lastSeenAt: checkedAt,
    lastCheckedAt: checkedAt
  };
}

export async function fetchAllEvents() {
  const html = await fetchText(LIST);
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
  return { source: 'allevents', events, diagnostics: { candidates: candidates.length } };
}
