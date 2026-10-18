import {fetchText} from '../lib/http.mjs';
import {stableId,slugify,stripHtml,nowIso,parseMoney} from '../lib/utils.mjs';

const LIST='https://thrillzone.in/events.html';
const MONTHS={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};

export function parseThrillZone(html,checkedAt=nowIso()) {
  if(!/Upcoming Events By Thrill Zone/i.test(html)) throw new Error('Thrill Zone upcoming-events section missing');
  const cards=html.split(/<div\s+class=["'][^"']*blog-content\b[^"']*["'][^>]*>/i).slice(1);
  const events=[];
  for(const card of cards) {
    const titleMatch=card.match(/<h4\b[^>]*>\s*<a\s+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    const dateMatch=stripHtml(card).match(/Date\s*:\s*(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?\s*(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if(!titleMatch || !dateMatch) continue;
    const title=stripHtml(titleMatch[2]);
    const plain=stripHtml(card);
    if(!/Location\s*:\s*Dehradun\b/i.test(plain) || !/\bDehradun\b/i.test(title)) continue;
    const month=MONTHS[dateMatch[2].slice(0,3).toLowerCase()];
    if(!month) continue;
    const hour=(Number(dateMatch[4])%12)+(dateMatch[6].toUpperCase()==='PM'?12:0);
    const startAt=`${dateMatch[3]}-${String(month).padStart(2,'0')}-${dateMatch[1].padStart(2,'0')}T${String(hour).padStart(2,'0')}:${dateMatch[5]}:00+05:30`;
    const url=new URL(titleMatch[1],LIST).href;
    const price=parseMoney(plain);
    events.push({
      id:stableId('thrillzone',url,startAt),slug:slugify(title),title,
      description:'Thrill Zone running event in Dehradun. Check the organizer for route, venue and registration details.',
      startAt,venue:{name:'Venue TBA',city:'Dehradun'},categories:['Outdoors'],pricing:price,
      sources:[{provider:'thrillzone',url,checkedAt,confidence:.9}],verificationStatus:'verified',
      curation:{status:'published',score:7},firstSeenAt:checkedAt,lastSeenAt:checkedAt,lastCheckedAt:checkedAt
    });
  }
  if(!events.length) throw new Error('Thrill Zone yielded no dated Dehradun events');
  return {source:'thrillzone',events,diagnostics:{cards:cards.length,eventsParsed:events.length}};
}

export async function fetchThrillZone() { return parseThrillZone(await fetchText(LIST)); }
