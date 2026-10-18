import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchDistrict} from '../ingest/sources/district.mjs';

const listingUrl='https://www.district.in/events/upcoming-events-in-dehradun';
function response(body,status,url,headers={}) {
  const result=new Response(body,{status,headers});
  Object.defineProperty(result,'url',{value:url});
  return result;
}
const withFetch=async (t,handler)=>{
  const original=globalThis.fetch;
  t.after(()=>{globalThis.fetch=original;});
  globalThis.fetch=handler;
};

test('a listing with a Dehradun event produces a district event',async t=>{
  const ld={'@context':'https://schema.org','@type':'Event',name:'Doon Music Night',startDate:'2026-11-01T18:00:00+05:30',
    location:{name:'Rajpur Road Hall',address:{addressLocality:'Dehradun'}},url:'https://www.district.in/events/doon-music-night'};
  const html=`<html><script type="application/ld+json">${JSON.stringify(ld)}</script></html>`;
  await withFetch(t,async url=>response(html,200,url));
  const result=await fetchDistrict();
  assert.equal(result.source,'district');
  assert.equal(result.events.length,1);
  assert.equal(result.events[0].venue.city,'Dehradun');
  assert.equal(result.diagnostics.eventsParsed,1);
});

test('a 200 challenge page with no events is a failure, not a healthy fetch',async t=>{
  await withFetch(t,async url=>response('<html><title>Just a moment...</title><body>Checking your browser</body></html>',200,url));
  await assert.rejects(fetchDistrict(),error=>{
    assert.match(error.message,/yielded no Dehradun events/);
    assert.equal(error.diagnostics.eventsParsed,0);
    assert.equal(error.diagnostics.candidates,0);
    return true;
  });
});

test('a 403 is a failure with safe diagnostics',async t=>{
  await withFetch(t,async url=>response('blocked',403,url,{'content-type':'text/html'}));
  await assert.rejects(fetchDistrict(),error=>{
    assert.equal(error.diagnostics.status,403);
    assert.equal(error.diagnostics.requestedUrl,listingUrl);
    return true;
  });
});
