import fs from 'node:fs/promises';
import {fetchDistrict} from './sources/district.mjs';
import {fetchBookMyShow} from './sources/bookmyshow.mjs';
import {fetchReddit} from './sources/reddit.mjs';
import {fetchAllEvents} from './sources/allevents.mjs';
import {fetchTownscript} from './sources/townscript.mjs';
import {mergeAndWrite} from './merge.mjs';
const adapters=[fetchDistrict,fetchBookMyShow,fetchAllEvents,fetchTownscript,fetchReddit]; const results=[]; const status={ranAt:new Date().toISOString(),sources:{}};
for(const fn of adapters){
  const name=fn.name.replace(/^fetch/,'').toLowerCase();
  try{const r=await fn();results.push(r);status.sources[r.source]={status:'ok',events:r.events?.length||0,review:r.reviewCandidates?.length||0,diagnostics:r.diagnostics||{}};}
  catch(e){status.sources[name]={status:'failed',error:String(e?.stack||e)}}
}
const counts=await mergeAndWrite(results); status.output=counts;
await fs.writeFile('data/ingest-status.json',JSON.stringify(status,null,2)+'\n');
console.log(JSON.stringify(status,null,2));
if(counts.published===0){console.error('No published upcoming events after ingest; retaining previous data may have failed.'); process.exitCode=2;}
