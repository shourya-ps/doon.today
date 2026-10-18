import fs from 'node:fs/promises';
import { slugify, eventPassesGeo } from './lib/utils.mjs';

const SOURCE_RANK = {
  manual: 100,
  district: 95,
  bookmyshow: 95,
  townscript: 85,
  virasat: 90,
  allevents: 75,
  reddit: 50
};

function norm(s='') { return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function tokens(s='') { return new Set(norm(s).split(' ').filter(Boolean)); }
function similarity(a='', b='') {
  const A=tokens(a), B=tokens(b);
  if (!A.size || !B.size) return 0;
  let common=0; for (const t of A) if (B.has(t)) common++;
  return common / Math.max(A.size, B.size);
}
function sourceRank(e) {
  return Math.max(0, ...(e.sources || []).map(s => SOURCE_RANK[s.provider] || 0));
}
function eventTimestamp(e) {
  return Math.max(
    ...[e.lastCheckedAt, e.lastSeenAt, e.firstSeenAt]
      .map(value => Date.parse(value || ''))
      .filter(Number.isFinite),
    0
  );
}
function verificationStatus(sources=[]) {
  const providers=new Set(sources.map(source => source.provider));
  if (['manual','district','bookmyshow','townscript','virasat'].some(provider => providers.has(provider))) return 'verified';
  if (providers.size === 1 && providers.has('reddit')) return 'community-reported';
  return 'review';
}
function sameEvent(a,b) {
  if (!a?.startAt || !b?.startAt) return false;
  if (a.startAt.slice(0,10) !== b.startAt.slice(0,10)) return false;
  const titleScore=similarity(a.title,b.title);
  const venueScore=similarity(a.venue?.name,b.venue?.name);
  return titleScore >= 0.72 && (venueScore >= 0.5 || /venue tba/i.test(a.venue?.name||'') || /venue tba/i.test(b.venue?.name||''));
}
function sourceKey(s){ return `${s.provider}|${s.url}`; }
function mergePair(a,b) {
  const preferred = sourceRank(b) > sourceRank(a) || (sourceRank(b) === sourceRank(a) && eventTimestamp(b) >= eventTimestamp(a)) ? b : a;
  const secondary = preferred === a ? b : a;
  const sources=[...(a.sources||[]),...(b.sources||[])];
  const unique=[...new Map(sources.map(s=>[sourceKey(s),s])).values()];
  return {
    ...secondary,
    ...preferred,
    id: a.id || b.id,
    slug: a.slug || b.slug || slugify(preferred.title),
    sources: unique,
    verificationStatus: verificationStatus(unique),
    firstSeenAt: [a.firstSeenAt,b.firstSeenAt].filter(Boolean).sort()[0],
    lastSeenAt: [a.lastSeenAt,b.lastSeenAt].filter(Boolean).sort().at(-1),
    lastCheckedAt: [a.lastCheckedAt,b.lastCheckedAt].filter(Boolean).sort().at(-1),
    curation: preferred.curation?.status === 'published' ? preferred.curation : secondary.curation
  };
}

export async function mergeAndWrite(results) {
  let previous=[];
  try { previous=JSON.parse(await fs.readFile('data/events.json','utf8')); } catch {}

  previous = previous.filter(eventPassesGeo);

  const current=[];
  for (const r of results) {
    for (const incoming of r.events || []) {
      if (!eventPassesGeo(incoming)) continue;
      const idx=current.findIndex(existing => sameEvent(existing,incoming));
      if (idx >= 0) current[idx]=mergePair(current[idx],incoming);
      else current.push({...incoming, verificationStatus: verificationStatus(incoming.sources)});
    }
  }

  const merged=[];
  for (const incoming of current) {
    const old=previous.find(e => sameEvent(e,incoming));
    merged.push(old ? mergePair(old,incoming) : incoming);
  }

  const now=Date.now();
  for (const e of previous) {
    if (new Date(e.startAt).getTime() <= now) continue;
    if (!merged.some(x => sameEvent(x,e))) merged.push({...e, verificationStatus: verificationStatus(e.sources)});
  }

  const out=merged
    .filter(eventPassesGeo)
    .filter(e => e.curation?.status === 'published')
    .filter(e => new Date(e.startAt).getTime() > now - 6*3600_000)
    .sort((a,b)=>a.startAt.localeCompare(b.startAt));

  await fs.mkdir('data',{recursive:true});
  await fs.writeFile('data/events.json',JSON.stringify(out,null,2)+'\n');

  const review=results.flatMap(r=>r.reviewCandidates||[]);
  await fs.mkdir('data/review',{recursive:true});
  await fs.writeFile('data/review/reddit.json',JSON.stringify(review,null,2)+'\n');
  return {published:out.length,review:review.length};
}
