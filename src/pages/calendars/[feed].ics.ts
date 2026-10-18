import type { APIRoute } from 'astro';
import { events } from '../../data/events';
import { buildCalendar } from '../../lib/ics.mjs';
import { eventsForFeed, feedDefinitions } from '../../lib/feeds.mjs';

export function getStaticPaths() {
  return feedDefinitions().map((feed) => ({ params: { feed: feed.id }, props: { feed } }));
}

export const GET: APIRoute = ({ props }) => {
  const feed = props.feed;
  return new Response(
    buildCalendar({ name: `doon.today: ${feed.label}`, description: `${feed.description} in Dehradun, from doon.today`, events: eventsForFeed(feed, events) }),
    { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `inline; filename="${feed.id}.ics"` } }
  );
};
