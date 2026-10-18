import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fetchBookMyShow} from '../ingest/sources/bookmyshow.mjs';

const listingUrl='https://in.bookmyshow.com/explore/events-dehradun';
const detailUrl='https://in.bookmyshow.com/events/doon-music-night/ET00999999';
const fixture=(name)=>readFile(new URL(`./fixtures/${name}`,import.meta.url),'utf8');
function response(body,status,url,headers={}) {
  const result=new Response(body,{status,headers});
  Object.defineProperty(result,'url',{value:url});
  return result;
}

test('a listing and event page produce a Dehradun event',async t=>{
  const original=globalThis.fetch;
  t.after(()=>{globalThis.fetch=original;});
  const listing=await fixture('bookmyshow-listing.html');
  const detail=await fixture('bookmyshow-event.html');
  const requested=[];
  globalThis.fetch=async url=>{
    requested.push(url);
    if(url===listingUrl) return response(listing,200,url);
    if(url===detailUrl) return response(detail,200,url);
    throw new Error(`Unexpected URL: ${url}`);
  };
  const result=await fetchBookMyShow();
  assert.deepEqual(requested,[listingUrl,detailUrl]);
  assert.equal(result.diagnostics.discoveredUrls,1);
  assert.equal(result.diagnostics.eventsParsed,1);
  assert.equal(result.events[0].sources[0].provider,'bookmyshow');
  assert.equal(result.events[0].venue.city,'Dehradun');
});

test('a 403 captures safe diagnostics before parsing',async t=>{
  const original=globalThis.fetch;
  t.after(()=>{globalThis.fetch=original;});
  globalThis.fetch=async url=>response('blocked',403,url,{'content-type':'text/html','server':'edge'});
  await assert.rejects(fetchBookMyShow(),error=>{
    assert.equal(error.diagnostics.status,403);
    assert.equal(error.diagnostics.requestedUrl,listingUrl);
    assert.equal(error.diagnostics.contentType,'text/html');
    assert.equal(error.diagnostics.server,'edge');
    return true;
  });
});

test('a 200 response with no event links is not treated as healthy',async t=>{
  const original=globalThis.fetch;
  t.after(()=>{globalThis.fetch=original;});
  globalThis.fetch=async url=>response('<html><body>No server-rendered events</body></html>',200,url);
  await assert.rejects(fetchBookMyShow(),error=>{
    assert.equal(error.diagnostics.discoveredUrls,0);
    return true;
  });
});

test('event pages with no usable Dehradun data are not treated as healthy',async t=>{
  const original=globalThis.fetch;
  t.after(()=>{globalThis.fetch=original;});
  const listing=await fixture('bookmyshow-listing.html');
  globalThis.fetch=async url=>response(url===listingUrl?listing:'<html></html>',200,url);
  await assert.rejects(fetchBookMyShow(),error=>{
    assert.equal(error.diagnostics.discoveredUrls,1);
    assert.equal(error.diagnostics.eventsParsed,0);
    return true;
  });
});

test('it stops requesting event pages after two consecutive 403s',async t=>{
  const original=globalThis.fetch;
  t.after(()=>{globalThis.fetch=original;});
  const hrefs=[1,2,3,4,5].map(n=>`<a href="https://in.bookmyshow.com/events/show-${n}/ET0000000${n}">x</a>`).join('');
  const requested=[];
  globalThis.fetch=async url=>{
    requested.push(url);
    return url===listingUrl ? response(`<html>${hrefs}</html>`,200,url) : response('blocked',403,url,{server:'cloudflare'});
  };
  await assert.rejects(fetchBookMyShow(),error=>{
    assert.equal(error.diagnostics.discoveredUrls,5);
    assert.equal(error.diagnostics.stoppedEarly,true);
    assert.equal(error.diagnostics.errors.length,2);
    return true;
  });
  assert.equal(requested.length,3,'one listing request and two blocked event pages');
});
