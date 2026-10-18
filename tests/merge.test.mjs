import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {sameEvent,istDay,mergeAndWrite} from '../ingest/merge.mjs';

const ev=(over={})=>({
  id:'x',slug:'x',title:'Doon Music Night',description:'',startAt:'2030-01-10T18:00:00+05:30',
  venue:{name:'Rajpur Road Hall',address:'Rajpur Road',city:'Dehradun'},
  categories:['Music'],sources:[{provider:'district',url:'https://example.test/e'}],
  curation:{status:'published',score:8},firstSeenAt:'2030-01-01T00:00:00Z',lastSeenAt:'2030-01-01T00:00:00Z',lastCheckedAt:'2030-01-01T00:00:00Z',
  ...over
});

test('istDay reads the day in IST regardless of how the instant is written',()=>{
  assert.equal(istDay('2026-10-18T09:30:00.000Z'),'2026-10-18');
  assert.equal(istDay('2026-10-18T15:00:00+05:30'),'2026-10-18');
  assert.equal(istDay('2026-10-18T20:00:00.000Z'),'2026-10-19','20:00Z is 01:30 IST the next day');
  assert.equal(istDay('2026-10-18T23:30:00'),'2026-10-18','no offset means IST');
  assert.equal(istDay('2026-10-18'),'2026-10-18');
});

test('the same event with a shorter and a longer venue name is one event',()=>{
  const a=ev({title:'Sanjh-E-Rass',startAt:'2026-10-18T09:30:00.000Z',venue:{name:'J P Plaza & Garden wedding point and party lawn',city:'Dehradun'}});
  const b=ev({title:'Sanjh-E-Rass',startAt:'2026-10-18T15:00:00+05:30',venue:{name:'J P Plaza & Garden',city:'Dehradun'}});
  assert.equal(sameEvent(a,b),true);
});

test('different venues or different days are still different events',()=>{
  const a=ev();
  assert.equal(sameEvent(a,ev({venue:{name:'Parade Ground',city:'Dehradun'}})),false);
  assert.equal(sameEvent(a,ev({startAt:'2030-01-11T18:00:00+05:30'})),false);
  assert.equal(sameEvent(a,ev({title:'Totally Different Show'})),false);
});

async function inTempDir(t){
  const original=process.cwd();
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'doon-merge-'));
  process.chdir(dir);
  t.after(async()=>{process.chdir(original);await fs.rm(dir,{recursive:true,force:true});});
  await fs.mkdir('data/review',{recursive:true});
  return dir;
}

test('previously stored duplicates collapse on the next merge',async t=>{
  await inTempDir(t);
  const a=ev({id:'0f66584b14129c23',title:'Sanjh-E-Rass',startAt:'2030-10-18T09:30:00.000Z',venue:{name:'J P Plaza & Garden wedding point and party lawn',city:'Dehradun'}});
  const b=ev({id:'sanjh-e-rass-2030-10-18',title:'Sanjh-E-Rass',startAt:'2030-10-18T15:00:00+05:30',venue:{name:'J P Plaza & Garden',city:'Dehradun'}});
  await fs.writeFile('data/events.json',JSON.stringify([a,b]));
  const counts=await mergeAndWrite([]);
  const out=JSON.parse(await fs.readFile('data/events.json','utf8'));
  assert.equal(counts.published,1);
  assert.equal(out.length,1);
});

test('a run without Reddit leaves the Reddit review queue alone',async t=>{
  await inTempDir(t);
  await fs.writeFile('data/events.json','[]');
  await fs.writeFile('data/review/reddit.json',JSON.stringify([{title:'candidate'}]));
  const district={source:'district',events:[ev()]};
  const counts=await mergeAndWrite([district]);
  assert.equal(counts.review,1);
  assert.equal(JSON.parse(await fs.readFile('data/review/reddit.json','utf8')).length,1);
  const withReddit=await mergeAndWrite([district,{source:'reddit',events:[],reviewCandidates:[]}]);
  assert.equal(withReddit.review,0);
  assert.equal(JSON.parse(await fs.readFile('data/review/reddit.json','utf8')).length,0);
});
