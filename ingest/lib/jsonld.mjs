export function extractJsonLd(html='') {
  const out=[];
  const re=/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while((m=re.exec(html))) {
    try { out.push(JSON.parse(m[1].trim())); } catch {}
  }
  return out;
}
export function flattenObjects(value,out=[]) {
  if(!value) return out;
  if(Array.isArray(value)) { value.forEach(v=>flattenObjects(v,out)); return out; }
  if(typeof value==='object') { out.push(value); Object.values(value).forEach(v=>flattenObjects(v,out)); }
  return out;
}
export function eventLikeObjects(html='') {
  return flattenObjects(extractJsonLd(html)).filter(o => {
    const t=o?.['@type'];
    return t==='Event' || (Array.isArray(t) && t.includes('Event'));
  });
}
