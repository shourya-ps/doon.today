import {fetchText} from '../lib/http.mjs';
import {eventLikeObjects,flattenObjects} from '../lib/jsonld.mjs';
import {stableId,slugify,parseMoney,categoryFromText,isDehradunText,stripHtml,nowIso} from '../lib/utils.mjs';
const LIST='https://www.district.in/events/upcoming-events-in-dehradun';
function toEvent(o,url=LIST){
  const loc=o.location||o.venue||{}; const addr=typeof loc.address==='string'?loc.address:(loc.address?.streetAddress||'')+' '+(loc.address?.addressLocality||'');
  const title=o.name||o.title; const start=o.startDate||o.start_at||o.startTime||o.start_time;
  const text=[title,o.description,loc.name,addr,o.city,o.locationName].filter(Boolean).join(' ');
  if(!title||!start||!isDehradunText(text)) return null;
  const checkedAt=nowIso(); const offers=Array.isArray(o.offers)?o.offers[0]:o.offers;
  return {id:stableId('district',o.url||o.slug||title,start),slug:slugify(title),title:stripHtml(title),description:stripHtml(o.description||''),startAt:start,endAt:o.endDate||o.end_at,venue:{name:loc.name||o.locationName||'Venue TBA',address:stripHtml(addr),city:'Dehradun'},categories:categoryFromText(text),pricing:offers?.price?{type:Number(offers.price)===0?'free':'paid',minPrice:Number(offers.price)||undefined,currency:'INR'}:parseMoney(JSON.stringify(o)),sources:[{provider:'district',url:o.url||url,externalId:String(o.id||o.eventId||'' )||undefined,checkedAt,confidence:.95}],verificationStatus:'verified',curation:{status:'published',score:8},firstSeenAt:checkedAt,lastSeenAt:checkedAt,lastCheckedAt:checkedAt};
}
export async function fetchDistrict(){
  const html=await fetchText(LIST); const candidates=[...eventLikeObjects(html)];
  const next=html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if(next){try{candidates.push(...flattenObjects(JSON.parse(next[1])))}catch{}}
  const seen=new Set(); const events=[];
  for(const o of candidates){const e=toEvent(o); if(e&&!seen.has(e.id)){seen.add(e.id);events.push(e)}}
  // A 200 that yields nothing (challenge page, changed markup) must not be recorded as a healthy fetch.
  if(events.length===0){
    const error=new Error('District listing yielded no Dehradun events; feed cannot be verified');
    error.diagnostics={listingUrl:LIST,listingBytes:Buffer.byteLength(html),candidates:candidates.length,eventsParsed:0,hasNextData:Boolean(next)};
    throw error;
  }
  return {source:'district',events,diagnostics:{listingBytes:Buffer.byteLength(html),candidates:candidates.length,eventsParsed:events.length}};
}
