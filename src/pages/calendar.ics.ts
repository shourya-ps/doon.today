import type { APIRoute } from 'astro';
import { events } from '../data/events';
const esc=(s='')=>s.replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
const dt=(iso)=>new Date(iso).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
export const GET: APIRoute = () => {
  const rows=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//doon.today//Events//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  for(const e of events.filter(e=>e.curation.status==='published')) rows.push('BEGIN:VEVENT',`UID:${e.id}@doon.today`,`DTSTAMP:${dt(e.lastCheckedAt)}`,`DTSTART:${dt(e.startAt)}`,...(e.endAt?[`DTEND:${dt(e.endAt)}`]:[]),`SUMMARY:${esc(e.title)}`,`LOCATION:${esc([e.venue.name,e.venue.area,'Dehradun'].filter(Boolean).join(', '))}`,`URL:https://doon.today/events/${e.slug}/`,'END:VEVENT');
  rows.push('END:VCALENDAR');
  return new Response(rows.join('\r\n')+'\r\n',{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'inline; filename="doon-today.ics"'}});
};
