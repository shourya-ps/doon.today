import fs from 'node:fs/promises';
const events=JSON.parse(await fs.readFile('data/events.json','utf8'));
const errors=[]; const ids=new Set();
for(const [i,e] of events.entries()){
  for(const k of ['id','slug','title','startAt','venue','sources']) if(e[k]==null) errors.push(`[${i}] missing ${k}`);
  if(e.venue?.city!=='Dehradun') errors.push(`[${i}] invalid city ${e.venue?.city}`);
  if(ids.has(e.id)) errors.push(`[${i}] duplicate id ${e.id}`); ids.add(e.id);
  if(Number.isNaN(new Date(e.startAt).getTime())) errors.push(`[${i}] invalid startAt`);
}
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log(`validated ${events.length} events`);
