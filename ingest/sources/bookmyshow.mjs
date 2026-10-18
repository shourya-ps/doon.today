import {fetchText} from '../lib/http.mjs';
import {eventLikeObjects} from '../lib/jsonld.mjs';
import {stableId,slugify,parseMoney,categoryFromText,isDehradunText,stripHtml,nowIso,sleep} from '../lib/utils.mjs';

const LIST='https://in.bookmyshow.com/explore/events-dehradun';
function absolute(href){ try{return new URL(href,LIST).href}catch{return null} }
function links(html){
  const out=new Set(); const re=/href=["']([^"']+)["']/gi; let m;
  while((m=re.exec(html))){const u=absolute(m[1]); if(u && /bookmyshow\.com\/(events|activities)\//.test(u)) out.add(u.split('?')[0]);}
  return [...out].slice(0,40);
}
function fromLd(o,url){
  const loc=o.location||{}; const addr=typeof loc.address==='string'?loc.address:(loc.address?.streetAddress||'')+' '+(loc.address?.addressLocality||'');
  const text=[o.name,o.description,loc.name,addr].filter(Boolean).join(' ');
  if(!o.name || !o.startDate || !isDehradunText(text)) return null;
  const offers=Array.isArray(o.offers)?o.offers[0]:o.offers;
  const pricing=offers?.price ? {type:Number(offers.price)===0?'free':'paid',minPrice:Number(offers.price)||undefined,currency:'INR'} : parseMoney(JSON.stringify(offers||{}));
  const checkedAt=nowIso();
  return {id:stableId('bookmyshow',o.url||url,o.startDate),slug:slugify(o.name),title:stripHtml(o.name),description:stripHtml(o.description||''),startAt:o.startDate,endAt:o.endDate,venue:{name:loc.name||'Venue TBA',address:stripHtml(addr),city:'Dehradun'},categories:categoryFromText(text),pricing,sources:[{provider:'bookmyshow',url:o.url||url,externalId:(url.match(/ET\d+/)||[])[0],checkedAt,confidence:.95}],verificationStatus:'verified',curation:{status:'published',score:8},firstSeenAt:checkedAt,lastSeenAt:checkedAt,lastCheckedAt:checkedAt};
}
export async function fetchBookMyShow(){
  const listing=await fetchText(LIST); const urls=links(listing); const events=[]; const errors=[];
  for(const url of urls){
    try{const html=await fetchText(url); for(const o of eventLikeObjects(html)){const e=fromLd(o,url); if(e) events.push(e);} await sleep(120);}catch(e){errors.push({url,error:String(e.message||e)});}
  }
  return {source:'bookmyshow',events,diagnostics:{discoveredUrls:urls.length,errors}};
}
