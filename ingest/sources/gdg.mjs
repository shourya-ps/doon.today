import { fetchText } from '../lib/http.mjs';
import { stableId, slugify, categoryFromText, isLikelyDehradunEvent, stripHtml, nowIso } from '../lib/utils.mjs';

// Google Developer Groups in Dehradun, on Google's community platform. Its public JSON API is what the chapter
// pages themselves read: each chapter's upcoming ("Live") events, then each event's own record for the venue and
// tickets. Talks, workshops, study jams and DevFest; few events, but none of the other sources carry them.
const BASE = 'https://gdg.community.dev';
export const CHAPTERS = [
  { id: 1312, name: 'GDG Dehradun' },
  { id: 1783, name: 'GDG on Campus UPES' },
  { id: 1729, name: 'GDG on Campus Graphic Era' }
];
export const listUrl = (chapter) => `${BASE}/api/event_slim/for_chapter/${chapter}/?status=Live&include_cohosted_events=true&visible_on_parent_chapter_only=true&order=start_date&page_size=50`;
export const eventUrl = (id) => `${BASE}/api/event/${id}/`;

/** Free when every ticket is 0; a price only when it is in rupees (the platform defaults to USD). */
export function priceFromTickets(tickets = []) {
  const prices = tickets.map((t) => Number(t?.price)).filter(Number.isFinite);
  if (prices.length && prices.every((p) => p === 0)) return { type: 'free', currency: 'INR' };
  const rupees = tickets.filter((t) => t?.currency === 'INR' && Number(t.price) > 0).map((t) => Number(t.price));
  if (!rupees.length) return { type: 'unknown', currency: 'INR' };
  const min = Math.min(...rupees), max = Math.max(...rupees);
  return { type: 'paid', minPrice: min, ...(max > min ? { maxPrice: max } : {}), currency: 'INR' };
}

/** An event from its own record, or null when it is online, cancelled, or not in Dehradun. */
export function toEvent(e, chapterName = 'GDG Dehradun') {
  if (!e?.title || !e.start_date || Number.isNaN(Date.parse(e.start_date))) return null;
  if (e.is_virtual_event || e.audience_type === 'VIRTUAL' || /cancel/i.test(e.status || '')) return null;
  const title = stripHtml(e.title);
  const description = stripHtml(e.description_short || e.description || '');
  const venueName = stripHtml(e.venue_name || '');
  const address = stripHtml([e.venue_address, e.venue_city, e.venue_zip_code].filter(Boolean).join(', '));
  const city = e.venue_city || e.chapter?.city || '';
  if (!isLikelyDehradunEvent({ title, description, venueName, address, city })) return null;
  const url = e.url || `${BASE}${e.relative_url || ''}`;
  const categories = categoryFromText(`${title} ${description}`);
  const checkedAt = nowIso();
  return {
    id: stableId('gdg', url, e.start_date),
    slug: slugify(title),
    title,
    description,
    startAt: e.start_date,
    ...(e.end_date && !Number.isNaN(Date.parse(e.end_date)) ? { endAt: e.end_date } : {}),
    venue: { name: venueName || chapterName, address, city: 'Dehradun' },
    // A developer meetup that names no other category is a community event.
    categories: categories.length === 1 && categories[0] === 'Other' ? ['Community'] : categories,
    pricing: priceFromTickets(e.tickets),
    sources: [{ provider: 'gdg', url, externalId: String(e.id), checkedAt, confidence: 0.9 }],
    verificationStatus: 'verified',
    curation: { status: 'published', score: 6 },
    firstSeenAt: checkedAt,
    lastSeenAt: checkedAt,
    lastCheckedAt: checkedAt
  };
}

export async function fetchGdg({ fetchPage = fetchText } = {}) {
  const events = [];
  const errors = [];
  let listed = 0;
  let chaptersRead = 0;
  for (const chapter of CHAPTERS) {
    let list;
    try { list = JSON.parse(await fetchPage(listUrl(chapter.id))); chaptersRead++; }
    catch (error) { errors.push({ chapter: chapter.name, error: String(error.message || error) }); continue; }
    for (const item of list.results || []) {
      listed++;
      try {
        const event = toEvent(JSON.parse(await fetchPage(eventUrl(item.id))), chapter.name);
        // A co-hosted event is listed under each of its chapters.
        if (event && !events.some((x) => x.id === event.id)) events.push(event);
      } catch (error) {
        errors.push({ event: item.id, error: String(error.message || error) });
      }
    }
  }
  if (chaptersRead === 0) {
    const error = new Error('No GDG chapter listing could be read');
    error.diagnostics = { errors };
    throw error;
  }
  return { source: 'gdg', events, diagnostics: { chapters: chaptersRead, listed, eventsParsed: events.length, ...(errors.length ? { errors } : {}) } };
}
