import type { APIRoute } from 'astro';
import { events } from '../data/events';

const esc=(s='')=>s.replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
const dateOnly=(s='')=>/^\d{4}-\d{2}-\d{2}$/.test(s);
const ymd=(s='')=>s.replace(/-/g,'');
const dt=(iso)=>new Date(iso).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
const nextDay=(iso)=>{
  const d=new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate()+1);
  return d.toISOString().slice(0,10);
};

function eventRows(e:any){
  const rows=['BEGIN:VEVENT',`UID:${e.id}@doon.today`,`DTSTAMP:${dt(e.lastCheckedAt)}`];

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
    `LOCATION:${esc([e.venue.name,e.venue.area,'Dehradun'].filter(Boolean).join(', '))}`,
    `URL:https://doon.today/events/${e.slug}/`,
    'END:VEVENT'
  );
  return rows;
}

export const GET: APIRoute = () => {
  const rows=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//doon.today//Events//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  for(const e of events.filter(e=>e.curation.status==='published')) rows.push(...eventRows(e));
  rows.push('END:VCALENDAR');
  return new Response(rows.join('\r\n')+'\r\n',{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'inline; filename="doon-today.ics"'}});
};
