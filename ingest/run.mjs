import fs from 'node:fs/promises';
import {fetchDistrict} from './sources/district.mjs';
import {fetchBookMyShow} from './sources/bookmyshow.mjs';
import {fetchReddit} from './sources/reddit.mjs';
import {fetchAllEvents} from './sources/allevents.mjs';
import {fetchTownscript} from './sources/townscript.mjs';
import {fetchVirasat} from './sources/virasat.mjs';
import {mergeAndWrite} from './merge.mjs';

const adapters=[fetchDistrict,fetchBookMyShow,fetchAllEvents,fetchTownscript,fetchVirasat,fetchReddit];
const results=[];
const status={ranAt:new Date().toISOString(),sources:{}};

for(const fn of adapters){
  const name=fn.name.replace(/^fetch/,'').toLowerCase();
  try{
    const r=await fn();
    results.push(r);
    status.sources[r.source]={
      status:'ok',
      events:r.events?.length||0,
      review:r.reviewCandidates?.length||0,
      diagnostics:r.diagnostics||{}
    };
  } catch(e) {
    status.sources[name]={status:'failed',error:String(e?.stack||e),...(e?.diagnostics ? {diagnostics:e.diagnostics} : {})};
  }
}

const counts=await mergeAndWrite(results);
status.output=counts;

const primary=['district','bookmyshow'];
const primaryOk=primary.filter(s=>status.sources[s]?.status==='ok');
const successful=Object.values(status.sources).filter(s=>s.status==='ok').length;
status.health =
  counts.published === 0 ? 'failed' :
  primaryOk.length === primary.length ? 'healthy' :
  successful > 0 ? 'degraded' : 'failed';
status.primarySourcesAvailable=primaryOk;
status.primarySourcesExpected=primary;

await fs.writeFile('data/ingest-status.json',JSON.stringify(status,null,2)+'\n');
console.log(JSON.stringify(status,null,2));

if(counts.published===0){
  console.error('No published upcoming events after ingest; retaining previous data may have failed.');
  process.exitCode=2;
}
