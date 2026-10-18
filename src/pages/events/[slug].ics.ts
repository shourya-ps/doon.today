import type { APIRoute } from 'astro';
import { events } from '../../data/events';

const esc=(s='')=>s.replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
const dateOnly=(s='')=>/^\d{4}-\d{2}-\d{2}$/.test(s);
const ymd=(s='')=>s.replace(/-/g,'');
const dt=(iso)=>new Date(iso).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
const nextDay=(iso)=>{
  const d=new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate()+1);
  return d.toISOString().slice(0,10);
};

export function getStaticPaths() {
  return events
    .filter(e=>e.curation.status==='published')
    .map(event=>({params:{slug:event.slug},props:{event}}));
}

export const GET: APIRoute = ({ props }) => {
  const e:any = props.event;
  const rows=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//doon.today//Event//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',`UID:${e.id}@doon.today`,`DTSTAMP:${dt(e.lastCheckedAt)}`];

  if(dateOnly(e.startAt)){
    rows.push(`DTSTART;VALUE=DATE:${ymd(e.startAt)}`);
    const end = dateOnly(e.endAt||'') && e.endAt !== e.startAt ? nextDay(e.endAt) : nextDay(e.startAt);
    rows.push(`DTEND;VALUE=DATE:${ymd(end)}`);
  } else {
    rows.push(`DTSTART:${dt(e.startAt)}`);
    if(e.endAt && !dateOnly(e.endAt)) rows.push(`DTEND:${dt(e.endAt)}`);
  }

  rows.push(
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(e.description || `Source: ${e.sources?.[0]?.url || 'https://doon.today/'}`)}`,
    `LOCATION:${esc([e.venue.name,e.venue.address,e.venue.area,'Dehradun'].filter(Boolean).join(', '))}`,
    `URL:https://doon.today/events/${e.slug}/`,
    'END:VEVENT',
    'END:VCALENDAR'
  );

  return new Response(rows.join('\r\n')+'\r\n',{
    headers:{
      'Content-Type':'text/calendar; charset=utf-8',
      'Content-Disposition':`attachment; filename="${e.slug}.ics"`
    }
  });
};
