import type { APIRoute } from 'astro';
import { events } from '../../data/events';
import { buildEventCalendar } from '../../lib/ics.mjs';

export function getStaticPaths() {
  return events
    .filter((e) => e.curation.status === 'published')
    .map((event) => ({ params: { slug: event.slug }, props: { event } }));
}

export const GET: APIRoute = ({ props }) => {
  const event = props.event;
  return new Response(buildEventCalendar(event), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.slug}.ics"`
    }
  });
};
