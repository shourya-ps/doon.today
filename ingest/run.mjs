import fs from 'node:fs/promises';
import {fetchDistrict} from './sources/district.mjs';
import {fetchBookMyShow} from './sources/bookmyshow.mjs';
import {fetchReddit} from './sources/reddit.mjs';
import {fetchAllEvents} from './sources/allevents.mjs';
import {fetchTownscript} from './sources/townscript.mjs';
import {fetchVirasat} from './sources/virasat.mjs';
import {fetchThrillZone} from './sources/thrillzone.mjs';
import {fetchLiteratureFestival} from './sources/literaturefestival.mjs';
import {fetchMeetup} from './sources/meetup.mjs';
import {mergeAndWrite} from './merge.mjs';
import {adapterName,selectAdapters,recordAttempt,computeHealth,DEFAULT_MAX_AGE_HOURS} from './lib/status.mjs';

const allAdapters=[fetchDistrict,fetchBookMyShow,fetchAllEvents,fetchTownscript,fetchVirasat,fetchThrillZone,fetchLiteratureFestival,fetchMeetup,fetchReddit];

// INGEST_ONLY / INGEST_SKIP take comma-separated source names (e.g. INGEST_ONLY=district,bookmyshow).
// District and BookMyShow reject GitHub-hosted runners, so they run from a separate job; every run
// only updates the sources it ran and keeps the other sources' status from the previous run.
const adapters=selectAdapters(allAdapters,{only:process.env.INGEST_ONLY,skip:process.env.INGEST_SKIP});
const maxAgeHours=Number(process.env.PRIMARY_MAX_AGE_HOURS)||DEFAULT_MAX_AGE_HOURS;

let previousStatus={};
try { previousStatus=JSON.parse(await fs.readFile('data/ingest-status.json','utf8')); } catch {}

const now=new Date();
const nowIso=now.toISOString();
const sources={...(previousStatus.sources||{})};
const results=[];
const ran=[];

for(const fn of adapters){
  const name=adapterName(fn);
  ran.push(name);
  try{
    const r=await fn();
    results.push(r);
    sources[r.source]=recordAttempt(sources[r.source],{
      status:'ok',
      events:r.events?.length||0,
      review:r.reviewCandidates?.length||0,
      diagnostics:r.diagnostics||{}
    },nowIso);
  } catch(e) {
    sources[name]=recordAttempt(sources[name],{
      status:'failed',
      error:String(e?.stack||e),
      ...(e?.diagnostics ? {diagnostics:e.diagnostics} : {})
    },nowIso);
  }
}

const counts=await mergeAndWrite(results);

const status={
  ranAt:nowIso,
  ran,
  sources,
  output:counts,
  ...computeHealth(sources,{now:now.getTime(),published:counts.published,maxAgeHours})
};

await fs.writeFile('data/ingest-status.json',JSON.stringify(status,null,2)+'\n');
console.log(JSON.stringify(status,null,2));

if(counts.published===0){
  console.error('No published upcoming events after ingest; retaining previous data may have failed.');
  process.exitCode=2;
}
