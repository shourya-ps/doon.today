// Fails when a primary source (District) that has worked before has not refreshed
// successfully for too long. A source that has never succeeded only produces a warning: otherwise a
// source we have no permitted access to yet (see docs/primary-sources.md) would keep every run red.
//
// Runs after the data is committed, so a red run signals a problem with the primary-source job,
// not that the site went without a refresh.
import fs from 'node:fs/promises';
import {PRIMARY_SOURCES,primaryFreshness} from '../ingest/lib/status.mjs';

const maxAgeHours=Number(process.env.HEALTH_MAX_AGE_HOURS)||48;
const status=JSON.parse(await fs.readFile('data/ingest-status.json','utf8'));
const freshness=primaryFreshness(status.sources||{},{now:Date.now(),maxAgeHours,primary:PRIMARY_SOURCES});

const stale=[];
for(const [name,f] of Object.entries(freshness)){
  if(f.fresh){
    console.log(`ok       ${name}: last success ${f.lastSuccessAt} (${f.ageHours}h ago)`);
  } else if(f.lastSuccessAt){
    console.log(`STALE    ${name}: last success ${f.lastSuccessAt} (${f.ageHours}h ago)`);
    stale.push(name);
  } else {
    console.log(`NEVER    ${name}: no successful fetch recorded`);
    console.log(`::warning title=${name} has never refreshed::No successful ${name} fetch is recorded in data/ingest-status.json`);
  }
}
if(stale.length){
  console.error(`\nPrimary source(s) stale for more than ${maxAgeHours}h: ${stale.join(', ')}.`);
  console.error('Check the "Refresh primary sources" workflow and the self-hosted runner (docs/primary-sources.md).');
  process.exit(1);
}
