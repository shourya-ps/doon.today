import {fetchText} from '../lib/http.mjs';
import {stableId,slugify,nowIso} from '../lib/utils.mjs';

const HOME='https://www.dehradunliteraturefestival.com/';
const MONTHS={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};

export function parseLiteratureFestival(html,checkedAt=nowIso()) {
  if(!/Dehradun Literature Festival/i.test(html)) throw new Error('Literature Festival identity missing');
  const normalized=html.replace(/&nbsp;|&#160;/gi,' ').replace(/<[^>]*>/g,' ');
  const match=normalized.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})\s*[-–]\s*(\d{1,2}),?\s*(20\d{2})\b/i);
  if(!match) throw new Error('Literature Festival date range missing');
  const month=String(MONTHS[match[1].toLowerCase()]).padStart(2,'0');
  const startAt=`${match[4]}-${month}-${match[2].padStart(2,'0')}`;
  const endAt=`${match[4]}-${month}-${match[3].padStart(2,'0')}`;
  if(new Date(endAt)<new Date(startAt)) throw new Error('Literature Festival date range invalid');
  const title=`Dehradun Literature Festival ${match[4]}`;
  return {source:'literaturefestival',events:[{
    id:stableId('literaturefestival',match[4]),slug:slugify(title),title,
    description:'Three-day Dehradun literature and arts festival. Session schedule, exact venue and times are not yet listed on the official events page.',
    startAt,endAt,venue:{name:'Venue TBA',city:'Dehradun'},categories:['Books','Culture'],pricing:{type:'unknown',currency:'INR'},
    sources:[{provider:'literaturefestival',url:HOME,checkedAt,confidence:.9}],verificationStatus:'verified',
    curation:{status:'published',score:7},firstSeenAt:checkedAt,lastSeenAt:checkedAt,lastCheckedAt:checkedAt
  }],diagnostics:{festivalDates:`${startAt}/${endAt}`,sessionsParsed:0}};
}

export async function fetchLiteratureFestival() { return parseLiteratureFestival(await fetchText(HOME)); }
