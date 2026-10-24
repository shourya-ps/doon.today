// Display names for event sources.
export const SOURCE_LABELS = {
  district: 'District',
  bookmyshow: 'BookMyShow',
  allevents: 'AllEvents',
  townscript: 'Townscript',
  virasat: 'Virasat',
  thrillzone: 'Thrill Zone',
  literaturefestival: 'Dehradun Literature Festival',
  meetup: 'Meetup',
  reddit: 'r/Dehradun',
  manual: 'doon.today'
};

export const sourceLabel = (provider) => SOURCE_LABELS[provider] ?? provider;

/**
 * The label for an event's main link, or null when there is nothing worth linking to. A source's own
 * listing says "Tickets and details on District". A hand-checked event ("manual") links wherever the
 * reviewer pointed it, so the label names that place instead of doon.today; a review issue on GitHub
 * (used only when a submission had no link of its own) isn't shown at all.
 */
export function detailsLinkLabel(source) {
  if (!source?.url) return null;
  if (source.provider !== 'manual') return `Tickets and details on ${sourceLabel(source.provider)}`;
  let host = '';
  try { host = new URL(source.url).hostname.replace(/^www\./, ''); } catch { return null; }
  if (host === 'github.com') return null;
  if (host === 'reddit.com' || host.endsWith('.reddit.com')) return 'Details in the r/Dehradun post';
  if (host === 'instagram.com') return 'Details on Instagram';
  return `Details on ${host}`;
}
