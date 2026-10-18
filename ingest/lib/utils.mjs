import crypto from 'node:crypto';

export const IST = '+05:30';
export const nowIso = () => new Date().toISOString();
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export function slugify(input='') {
  return input.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90);
}
export function stableId(...parts) {
  return crypto.createHash('sha1').update(parts.filter(Boolean).join('|').toLowerCase()).digest('hex').slice(0, 16);
}
export function stripHtml(s='') {
  return s.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
}
export function parseMoney(text='') {
  const m = text.replace(/,/g,'').match(/(?:₹|Rs\.?|INR)\s*(\d+)/i);
  if (/\bfree\b/i.test(text)) return {type:'free', currency:'INR'};
  return m ? {type:'paid', minPrice:Number(m[1]), currency:'INR'} : {type:'unknown', currency:'INR'};
}
export function isDehradunText(text='') {
  const s = text.toLowerCase();
  const positive = ['dehradun','rajpur','dalanwala','hathibarkala','hathibarkala','jakhan','malsi','clement town','race course','kaulagarh','prem nagar','sahastradhara','raipur','ballupur','gms road','clock tower','paltan bazaar','doon library'];
  const negative = ['rishikesh','haridwar','mussoorie','roorkee','chandigarh','delhi','gurugram','noida','mumbai','bengaluru','bangalore','pune','kolkata'];
  if (negative.some(x => s.includes(x)) && !s.includes('dehradun')) return false;
  return positive.some(x => s.includes(x));
}
export function categoryFromText(text='') {
  const s=text.toLowerCase();
  const rules=[
    ['Comedy',['comedy','stand up','stand-up','open mic']],['Music',['music','concert','gig','live band','dj']],['Books',['book','literature','poetry','reading']],['Outdoors',['run','marathon','walk','hike','trek','bird','cycling']],['Art',['art','paint','exhibition','gallery']],['Workshop',['workshop','masterclass']],['Film',['film','cinema','screening']],['Culture',['dandiya','garba','heritage','culture','folk','festival']],['Community',['meetup','community','social club']]
  ];
  const out=rules.filter(([,ks])=>ks.some(k=>s.includes(k))).map(([c])=>c);
  return out.length ? [...new Set(out)] : ['Other'];
}
