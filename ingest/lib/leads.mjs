// Leads waiting for review live as GitHub issues labelled "lead": one per submit-form entry and one per
// r/Dehradun post the Reddit adapter flags. The issue body carries the event details in a fenced block,
// which the reviewer can edit; adding the "approve" label publishes it, closing the issue rejects it.
//
// Everything in a lead comes from the public, so it is treated as text: it stays inside the fenced block
// (where "@name" and "#12" don't notify or link anyone), loses backticks, and is cut to a sane length.
import { buildCuratedEvent, parsePrice, parseWhen } from './review.mjs';
import { CATEGORY_NAMES, areaFromText, categoryFromText } from './utils.mjs';

export const LEAD_LABEL = 'lead';
export const APPROVE_LABEL = 'approve';

// Fields in the order they appear in the issue. The description comes last and may run over several lines.
const FIELDS = [
  ['title', 'title'],
  ['starts', 'starts'],
  ['ends', 'ends'],
  ['venue', 'venue'],
  ['area', 'area'],
  ['price', 'price'],
  ['categories', 'categories'],
  ['listing', 'listing link'],
  ['organizer', 'organizer'],
  ['organizerLink', 'organizer link'],
  ['howToJoin', 'how to join'],
  ['repeats', 'repeats'],
  ['poster', 'poster'],
  ['post', 'post'],
  ['description', 'description']
];
const KEY_BY_LABEL = new Map(FIELDS.map(([key, label]) => [label, key]));

const MAX_LINE = 300;
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 1000;

/** One line of untrusted text: no line breaks or backticks, trimmed and capped. */
export function cleanLine(value, max = MAX_LINE) {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/`/g, "'").replace(/\s{2,}/g, ' ').trim().slice(0, max);
}

/** Several lines of untrusted text, for the description. */
export function cleanText(value, max = MAX_DESCRIPTION) {
  return String(value ?? '').replace(/\r\n?/g, '\n').replace(/`/g, "'").replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}

const cleanUrl = (value) => {
  const text = cleanLine(value);
  try { const u = new URL(text); return ['http:', 'https:'].includes(u.protocol) ? u.toString() : ''; } catch { return ''; }
};

/**
 * The lead for one submit-form entry (Netlify's submission data, keyed by input name), or null when it is
 * a bot (the hidden field is filled) or lacks a title or date. Contact details are left out on purpose:
 * the issue is public, and they stay in the Netlify submission.
 */
export function formLead(data = {}) {
  if (cleanLine(data['bot-field'])) return null;
  const title = cleanLine(data.title, MAX_TITLE);
  const date = cleanLine(data.date);
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time = cleanLine(data.time);
  const timeFixed = !cleanLine(data.time_tbd) && /^\d{1,2}:\d{2}$/.test(time);
  const endTime = cleanLine(data.end_time);
  const priceType = cleanLine(data.price_type).toLowerCase();
  const amount = cleanLine(data.price_amount).replace(/[^\d]/g, '');
  return {
    kind: 'form',
    title,
    starts: timeFixed ? `${date} ${time}` : date,
    ends: timeFixed && /^\d{1,2}:\d{2}$/.test(endTime) ? `${date} ${endTime}` : '',
    venue: cleanLine(data.venue),
    area: cleanLine(data.area),
    price: priceType === 'free' ? 'free' : priceType === 'paid' && amount ? amount : 'unknown',
    categories: cleanLine(data.category),
    listing: cleanUrl(data.listing_url),
    organizer: cleanLine(data.organizer),
    organizerLink: cleanLine(data.organizer_link),
    howToJoin: cleanLine(data.how_to_join),
    repeats: cleanLine(data.repeats),
    poster: cleanUrl(data.poster),
    post: '',
    description: cleanText(data.description)
  };
}

const istText = (iso) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return iso;
  const t = Date.parse(iso || '');
  return Number.isFinite(t) ? new Date(t + 5.5 * 3600_000).toISOString().slice(0, 16).replace('T', ' ') : '';
};

/** The lead for one r/Dehradun post the Reddit adapter queued (data/review/reddit.json). */
export function redditLead(candidate) {
  const venue = cleanLine(candidate.venue?.name);
  return {
    kind: 'reddit',
    id: candidate.id,
    title: cleanLine(candidate.title, MAX_TITLE),
    starts: istText(candidate.startAt),
    ends: '',
    venue: venue === 'See community post' ? '' : venue,
    area: '',
    price: 'unknown',
    categories: (candidate.categories || []).join(', '),
    listing: '',
    organizer: '',
    organizerLink: '',
    howToJoin: '',
    repeats: '',
    poster: '',
    post: cleanUrl(candidate.sources?.[0]?.url),
    description: cleanText(candidate.description)
  };
}

// "@" and "#" in an issue title don't notify anyone, but keep them from reading as handles or links.
const safeTitle = (text) => cleanLine(text, MAX_TITLE).replace(/@/g, '@​').replace(/#(\d)/g, '#​$1');

/** The GitHub issue (title, body, labels) that puts a lead in the review queue. */
export function leadIssue(lead) {
  const marker = lead.kind === 'reddit' ? `<!-- doon-lead kind=reddit id=${cleanLine(lead.id).replace(/[^a-z0-9-]/gi, '')} -->` : '<!-- doon-lead kind=form -->';
  const block = FIELDS.map(([key, label]) => {
    const value = key === 'description' ? cleanText(lead[key]) : cleanLine(lead[key], key === 'title' ? MAX_TITLE : MAX_LINE);
    return `${label}: ${value}`;
  }).join('\n');
  const intro = lead.kind === 'reddit'
    ? 'A post on r/Dehradun that looks like an event. The date and time were guessed from the post, and the venue is usually missing.'
    : 'An event sent through the submit form on doon.today. Contact details, if given, are only in the Netlify submission.';
  const body = [
    marker,
    intro,
    '',
    'To publish it, check the details, edit this issue to fix anything, then add the `approve` label. To reject it, close the issue.',
    '',
    'Dates are IST, as `YYYY-MM-DD HH:mm`, or `YYYY-MM-DD` when the time is not fixed. Price is `free`, `unknown` or an amount in rupees. Categories are any of: ' + CATEGORY_NAMES.join(', ') + '.',
    '',
    '### Event details',
    '',
    '```text',
    block,
    '```'
  ].join('\n');
  const when = lead.starts ? ` (${cleanLine(lead.starts).slice(0, 10)})` : '';
  return { title: `Lead: ${safeTitle(lead.title)}${when}`, body, labels: [LEAD_LABEL] };
}

/** The kind and Reddit id from a lead issue's hidden marker, even if the details block was edited away. */
export function leadMarker(body = '') {
  const m = String(body).match(/<!--\s*doon-lead\s+kind=(form|reddit)(?:\s+id=([a-z0-9-]+))?\s*-->/i);
  return m ? { kind: m[1].toLowerCase(), id: m[2] || '' } : null;
}

/** Reads a lead issue back, after any edits: its kind, its Reddit id if any, and the detail fields. */
export function parseLeadIssue(body = '') {
  const text = String(body).replace(/\r\n?/g, '\n');
  const marker = leadMarker(text);
  if (!marker) return null;
  const block = text.match(/```text\n([\s\S]*?)\n```/);
  if (!block) return null;
  const fields = Object.fromEntries(FIELDS.map(([key]) => [key, '']));
  const lines = block[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*([a-z ]+?)\s*:\s?(.*)$/i);
    const key = m && KEY_BY_LABEL.get(m[1].toLowerCase());
    if (!key) continue;
    if (key === 'description') { fields.description = cleanText([m[2], ...lines.slice(i + 1)].join('\n')); break; }
    fields[key] = cleanLine(m[2], key === 'title' ? MAX_TITLE : MAX_LINE);
  }
  return { ...marker, fields };
}

/** The review decision key for a lead: the Reddit candidate id, or the issue number for a form entry. */
export const leadKey = (parsed, issueNumber) => (parsed.kind === 'reddit' ? parsed.id : `form-${issueNumber}`);

const knownCategory = new Map(CATEGORY_NAMES.map((name) => [name.toLowerCase(), name]));

/**
 * The event to publish for an approved lead. Throws with a plain message when a detail is missing or
 * unreadable, so the reviewer can fix the issue and approve again. `issueUrl` identifies a form entry
 * that has no link of its own.
 */
export function leadToEvent(parsed, { issueUrl, candidate, now } = {}) {
  const f = parsed.fields;
  if (!f.title) throw new Error('the title is empty');
  if (!parseWhen(f.starts)) throw new Error(`"starts" must look like 2026-11-02 18:30 or 2026-11-02, not "${f.starts}"`);
  if (f.ends && !parseWhen(f.ends)) throw new Error(`"ends" must look like 2026-11-02 21:00, or be empty, not "${f.ends}"`);
  if (!f.venue) throw new Error('the venue is empty');
  if (!parsePrice(f.price)) throw new Error(`"price" must be free, unknown or an amount in rupees, not "${f.price}"`);

  const categories = f.categories.split(',').map((c) => knownCategory.get(c.trim().toLowerCase())).filter(Boolean);
  const organizerLink = cleanUrl(f.organizerLink);
  const extra = [
    f.organizer && `Organized by ${f.organizer}.`,
    f.howToJoin && `How to join: ${f.howToJoin}`,
    !f.listing && f.organizerLink && !organizerLink && `Organizer: ${f.organizerLink}`
  ].filter(Boolean).join(' ');
  const description = [f.description, extra].filter(Boolean).join('\n\n');
  const url = cleanUrl(f.listing) || organizerLink || (parsed.kind === 'reddit' ? cleanUrl(f.post) : '') || issueUrl;

  const base = candidate || { title: f.title, description, sources: [] };
  const event = buildCuratedEvent(base, {
    title: f.title,
    when: f.starts,
    endWhen: f.ends || undefined,
    venue: f.venue,
    price: f.price,
    url,
    description,
    categories: categories.length ? categories : categoryFromText(`${f.title} ${description}`)
  }, now);
  const area = f.area && (areaFromText(f.area) || f.area);
  return area ? { ...event, venue: { ...event.venue, area } } : event;
}
