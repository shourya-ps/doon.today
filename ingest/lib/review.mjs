// Review of community leads (r/Dehradun posts). A lead is never published on its own: a person approves it,
// which turns it into a hand-checked event in data/curated-events.json, or rejects it, which keeps it out of
// the queue for good. Both choices are recorded in data/review/decisions.json.
import fs from 'node:fs/promises';
import { stableId, slugify, categoryFromText } from './utils.mjs';

export const QUEUE_PATH = 'data/review/reddit.json';
export const DECISIONS_PATH = 'data/review/decisions.json';
export const CURATED_PATH = 'data/curated-events.json';

export async function readJson(path, fallback) {
  try { return JSON.parse(await fs.readFile(path, 'utf8')); } catch { return fallback; }
}
export const writeJson = (path, value) => fs.writeFile(path, JSON.stringify(value, null, 2) + '\n');

/** Leads nobody has decided on yet. */
export function pendingCandidates(queue = [], decisions = {}) {
  return queue.filter((c) => !decisions[c.id]);
}

/**
 * "2026-11-02 18:30" or "2026-11-02T18:30" becomes an IST timestamp; "2026-11-02" stays a date (an all-day
 * event). Returns null when the text is not a date.
 */
export function parseWhen(text = '') {
  const m = String(text).trim().match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  const [, day, hh, mm] = m;
  const probe = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(probe.getTime()) || probe.toISOString().slice(0, 10) !== day) return null;
  if (hh === undefined) return day;
  if (Number(hh) > 23 || Number(mm) > 59) return null;
  return `${day}T${hh.padStart(2, '0')}:${mm}:00+05:30`;
}

/** "free", "unknown" or an amount in rupees ("500", "₹500"). Returns null for anything else. */
export function parsePrice(text = '') {
  const t = String(text).trim().toLowerCase();
  if (t === 'free') return { type: 'free', currency: 'INR' };
  if (t === '' || t === 'unknown' || t === '?') return { type: 'unknown', currency: 'INR' };
  const m = t.replace(/,/g, '').match(/^(?:₹|rs\.?|inr)?\s*(\d+)$/);
  return m ? { type: 'paid', minPrice: Number(m[1]), currency: 'INR' } : null;
}

/**
 * The event that gets published for an approved lead. `details` is what the reviewer confirmed:
 * title, when (see parseWhen), endWhen (optional), venue, address (optional), price (see parsePrice),
 * categories (optional) and url (optional; the post is used when empty).
 */
export function buildCuratedEvent(candidate, details, now = new Date().toISOString()) {
  const post = candidate.sources?.[0]?.url || '';
  const startAt = parseWhen(details.when);
  if (!startAt) throw new Error(`Not a date: ${details.when}`);
  const endAt = details.endWhen ? parseWhen(details.endWhen) : null;
  if (details.endWhen && !endAt) throw new Error(`Not a date: ${details.endWhen}`);
  const pricing = parsePrice(details.price ?? 'unknown');
  if (!pricing) throw new Error(`Not a price: ${details.price}`);
  const title = String(details.title || candidate.title).trim();
  const venueName = String(details.venue || '').trim();
  if (!venueName) throw new Error('A venue is needed');

  const event = {
    // Without a post (a hand-added or submitted event) the details link identifies it, so two events at the
    // same time don't share an id.
    id: stableId('manual', post || details.url || title, startAt),
    slug: slugify(title),
    title,
    description: details.description ?? candidate.description ?? '',
    startAt,
    ...(endAt ? { endAt } : {}),
    venue: { name: venueName, ...(details.address ? { address: String(details.address).trim() } : {}), city: 'Dehradun' },
    categories: details.categories?.length ? details.categories : categoryFromText(`${title} ${candidate.description || ''}`),
    pricing,
    // The hand-check comes first; the post stays as provenance.
    sources: [
      { provider: 'manual', url: details.url || post, checkedAt: now, confidence: 1 },
      ...(candidate.sources || [])
    ],
    verificationStatus: 'verified',
    curation: { status: 'published', score: 5 },
    firstSeenAt: now,
    lastSeenAt: now,
    lastCheckedAt: now
  };
  return event;
}

/** The state after approving a lead: the lead leaves the queue and the event joins the curated list. */
export function approve({ decisions, curated }, candidate, event, now = new Date().toISOString()) {
  return {
    decisions: { ...decisions, [candidate.id]: { decision: 'approved', title: candidate.title, at: now, eventId: event.id } },
    curated: [...curated.filter((e) => e.id !== event.id), event]
  };
}

/** The state after rejecting a lead. The post is remembered, so it does not come back on the next run. */
export function reject({ decisions, curated }, candidate, note = '', now = new Date().toISOString()) {
  return {
    decisions: { ...decisions, [candidate.id]: { decision: 'rejected', title: candidate.title, at: now, ...(note ? { note } : {}) } },
    curated
  };
}
