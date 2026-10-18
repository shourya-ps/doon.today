import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseVirasatProgramme} from '../ingest/sources/virasat.mjs';

const fixture=(name)=>readFile(new URL(`./fixtures/${name}`,import.meta.url),'utf8');

test('Virasat imports only dated, ticketed headline performances',async()=>{
  const result=parseVirasatProgramme(
    await fixture('virasat-programme.html'),
    await fixture('virasat-tickets.html'),
    '2026-10-18T00:00:00.000Z'
  );
  assert.equal(result.events.length,2);
  assert.equal(result.diagnostics.dayBlocks,2);
  assert.equal(result.diagnostics.headlineCandidates,2);
  assert.deepEqual(result.events.map(event=>event.title),['Virasat 2026: Inaugural Concert','Virasat 2026: Doon Dance']);
  assert.equal(result.events[0].startAt,'2026-10-23T21:00:00+05:30');
  assert.equal(result.events[0].endAt,'2026-10-23T23:00:00+05:30');
  assert.equal(result.events[1].startAt,'2026-10-24T19:30:00+05:30');
  assert.equal(result.events[1].endAt,undefined);
  assert.equal(result.events[0].venue.city,'Dehradun');
  assert.equal(result.events[0].sources[0].url,'https://reachvirasat.org/programme#day-1');
  assert.equal(result.events[0].verificationStatus,'verified');
});

test('Virasat rejects an unverified venue or empty programme',async()=>{
  const programme=await fixture('virasat-programme.html');
  const tickets=await fixture('virasat-tickets.html');
  assert.throws(()=>parseVirasatProgramme(programme,'<html></html>'),/venue could not be verified/);
  assert.throws(()=>parseVirasatProgramme('<h1>Virasat 2026</h1>',tickets),/no dated headline performances/);
});
