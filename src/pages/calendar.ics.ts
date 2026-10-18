import type { APIRoute } from 'astro';
import { events } from '../data/events';
import { buildCalendar } from '../lib/ics.mjs';

export const GET: APIRoute = () =>
  new Response(
    buildCalendar({
      name: 'doon.today',
      description: 'Events in Dehradun, from doon.today',
      events: events.filter((e) => e.curation.status === 'published')
    }),
    { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="doon-today.ics"' } }
  );
