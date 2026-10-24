import {fetchText} from '../lib/http.mjs';
import {stripHtml,decodeEntities,categoryFromText,isDehradunText,stableId,slugify,nowIso} from '../lib/utils.mjs';
const FEEDS=['https://www.reddit.com/r/Dehradun/new/.rss'];
function entries(xml){return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map(m=>m[1]);}
function tag(s,name){const m=s.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,'i')); return m?stripHtml(decodeEntities(m[1].replace(/<!\[CDATA\[|\]\]>/g,''))):''}
function href(s){const m=s.match(/<link[^>]+href=["']([^"']+)["']/i);return m?.[1]||''}
function explicitDate(text){
  const months='Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';
  const m=text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${months})(?:\\s+(20\\d{2}))?\\b`,'i')) || text.match(new RegExp(`\\b(${months})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b`,'i'));
  if(!m) return null; const y=Number(m[3]||new Date().getFullYear()); const monFirst=/^[A-Za-z]/.test(m[1]); const month=monFirst?m[1]:m[2]; const day=Number(monFirst?m[2]:m[1]); const d=new Date(`${month} ${day}, ${y} 12:00:00 GMT+0530`); return Number.isNaN(d.getTime())?null:d.toISOString();
}
export async function fetchReddit(){
  const candidates=[]; const checkedAt=nowIso();
  for(const feed of FEEDS){const xml=await fetchText(feed); for(const raw of entries(xml)){
    const title=tag(raw,'title'), content=tag(raw,'content'), url=href(raw); const text=`${title} ${content}`; const date=explicitDate(text);
    const eventish=/event|meetup|workshop|festival|walk|run|book|screening|concert|open mic|exhibition|heritage|hike|trek|club/i.test(text);
    if(!date||!eventish||!isDehradunText(text)) continue;
    candidates.push({id:stableId('reddit',url,date),slug:slugify(title),title,description:content.slice(0,500),startAt:date,venue:{name:'See community post',city:'Dehradun'},categories:categoryFromText(text),pricing:{type:'unknown',currency:'INR'},sources:[{provider:'reddit',url,checkedAt,confidence:.5}],verificationStatus:'community-reported',curation:{status:'review',score:3},firstSeenAt:checkedAt,lastSeenAt:checkedAt,lastCheckedAt:checkedAt});
  }}
  return {source:'reddit',events:[],reviewCandidates:candidates,diagnostics:{candidates:candidates.length}};
}
