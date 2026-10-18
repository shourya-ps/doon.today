// The calendar feeds offered on /calendars: collections, one per category and one per source.
// The set is fixed (not derived from today's events) so a subscription never 404s when a category
// is empty for a while.
import { CATEGORY_NAMES } from '../../ingest/lib/utils.mjs';

export const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// BookMyShow is left out on purpose: it is demoted and produces no events.
export const SOURCE_LABELS = {
  district: 'District',
  allevents: 'AllEvents',
  townscript: 'Townscript',
  virasat: 'Virasat',
  thrillzone: 'Thrill Zone',
  literaturefestival: 'Dehradun Literature Festival',
  meetup: 'Meetup',
  reddit: 'r/Dehradun'
};

const isPublished = (e) => e.curation?.status === 'published';

/** Every feed: { id, kind, label, description, filter }. `id` is the file name, `/calendars/<id>.ics`. */
export function feedDefinitions() {
  return [
    { id: 'verified', kind: 'collection', label: 'Verified only', description: 'Confirmed by a primary source or organizer; leaves out events reported only by aggregators', filter: (e) => e.verificationStatus === 'verified' },
    { id: 'free', kind: 'collection', label: 'Free', description: 'Free events', filter: (e) => e.pricing?.type === 'free' },
    ...CATEGORY_NAMES.map((name) => ({ id: `category-${slug(name)}`, kind: 'category', label: name, description: `${name} events`, filter: (e) => (e.categories || []).includes(name) })),
    ...Object.entries(SOURCE_LABELS).map(([provider, label]) => ({ id: `source-${provider}`, kind: 'source', label, description: `Events listed by ${label}`, filter: (e) => (e.sources || []).some((s) => s.provider === provider) }))
  ];
}

export const feedPath = (id) => `/calendars/${id}.ics`;

export function eventsForFeed(feed, events) {
  return events.filter(isPublished).filter(feed.filter);
}
