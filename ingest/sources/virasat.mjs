import {fetchText} from '../lib/http.mjs';
import {stableId,slugify,stripHtml,nowIso} from '../lib/utils.mjs';

const PROGRAMME='https://reachvirasat.org/programme';
const TICKETS='https://reachvirasat.org/tickets';
const HEADLINE_CATEGORIES=new Set(['vocal','instrumental','dance','folk']);
const MONTHS={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12};

function localDateTime(year,month,day,time) {
  const match=time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if(!match) return null;
  const hour=(Number(match[1])%12)+(match[3].toUpperCase()==='PM'?12:0);
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(hour).padStart(2,'0')}:${match[2]}:00+05:30`;
}

export function parseVirasatProgramme(programme,tickets,checkedAt=nowIso()) {
  const year=Number(programme.match(/Virasat\s+(20\d{2})/i)?.[1]);
  const venueDescription=stripHtml(tickets.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)?.[1]||'');
  const venue=venueDescription.match(/\bat (?:the )?([^,.]+),\s*Garhi Cantt,\s*Dehradun\b/i)?.[1]?.trim();
  if(!year || !venue) throw new Error('Virasat year or official venue could not be verified');

  const events=[];
  let dayBlocks=0;
  let headlineCandidates=0;
  for(const block of programme.matchAll(/<section\b([^>]*class=["'][^"']*day-block[^"']*["'][^>]*)>([\s\S]*?)<\/section>/gi)) {
    dayBlocks++;
    const dayNumber=Number(block[1].match(/\bid=["']day-(\d+)["']/i)?.[1]);
    const dateText=stripHtml(block[2].match(/<span\s+class=["']ddate["']>([\s\S]*?)<\/span>/i)?.[1]||'');
    const dateMatch=dateText.match(/^(\d{1,2})\s+([A-Za-z]+)$/);
    const day=Number(dateMatch?.[1]);
    const month=MONTHS[dateMatch?.[2]?.toLowerCase()];
    if(!dayNumber || !day || !month) continue;

    for(const article of block[2].matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/gi)) {
      const category=article[1].match(/\bdata-cat=["']([^"']*)["']/i)?.[1]?.toLowerCase();
      const ticketed=article[1].match(/\bdata-tix=["']([^"']*)["']/i)?.[1]==='1';
      if(!ticketed || !HEADLINE_CATEGORIES.has(category)) continue;
      headlineCandidates++;
      const title=stripHtml(article[2].match(/<div\s+class=["']sx-title["']>([\s\S]*?)<\/div>/i)?.[1]||'');
      const timeText=stripHtml(article[2].match(/<div\s+class=["']sx-time["']>([\s\S]*?)<\/div>/i)?.[1]||'');
      const startTime=timeText.match(/\b\d{1,2}:\d{2}\s*[AP]M\b/i)?.[0];
      const endTime=timeText.match(/\bto\s+(\d{1,2}:\d{2}\s*[AP]M)\b/i)?.[1];
      if(!title || !startTime) continue;
      const startAt=localDateTime(year,month,day,startTime);
      const parsedEnd=endTime ? localDateTime(year,month,day,endTime) : null;
      const endAt=parsedEnd && new Date(parsedEnd)>new Date(startAt) ? parsedEnd : undefined;
      if(!startAt) continue;
      const fullTitle=`Virasat ${year}: ${title}`;
      const sourceUrl=`${PROGRAMME}#day-${dayNumber}`;
      const categories=category==='dance'||category==='folk' ? ['Culture'] : ['Music','Culture'];
      events.push({
        id:stableId('virasat',year,day,title),
        slug:slugify(fullTitle),
        title:fullTitle,
        description:`Ticketed ${category} performance at Virasat ${year}. Check the official programme and ticket page for details.`,
        startAt,...(endAt ? {endAt} : {}),
        venue:{name:`${venue} — Auditorium`,address:'Garhi Cantt',city:'Dehradun'},
        categories,
        pricing:{type:'paid',currency:'INR'},
        sources:[{provider:'virasat',url:sourceUrl,externalId:`${year}-${dayNumber}-${slugify(title)}`,checkedAt,confidence:.95}],
        verificationStatus:'verified',
        curation:{status:'published',score:7},
        firstSeenAt:checkedAt,lastSeenAt:checkedAt,lastCheckedAt:checkedAt
      });
    }
  }
  if(events.length===0) {
    const error=new Error('Virasat programme yielded no dated headline performances');
    error.diagnostics={dayBlocks,headlineCandidates};
    throw error;
  }
  return {source:'virasat',events,diagnostics:{dayBlocks,headlineCandidates,eventsParsed:events.length}};
}

export async function fetchVirasat() {
  const [programme,tickets]=await Promise.all([fetchText(PROGRAMME),fetchText(TICKETS)]);
  return parseVirasatProgramme(programme,tickets);
}
