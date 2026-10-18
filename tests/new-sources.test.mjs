import test from 'node:test';
import assert from 'node:assert/strict';
import {parseThrillZone} from '../ingest/sources/thrillzone.mjs';
import {parseLiteratureFestival} from '../ingest/sources/literaturefestival.mjs';
import {parseMeetupDiscovery} from '../ingest/sources/meetup.mjs';

const checkedAt='2026-10-18T00:00:00.000Z';
const thrill=`<h3>Upcoming Events By Thrill Zone</h3>
<div class="blog-content"><div class="tags"><a>Date : Sunday 25 Oct 2026</a><a>05:30 AM</a></div><p>Location : Dehradun</p><h4><a href="https://www.sportifiindia.com/events/dhm">Dehradun Half Marathon 2026 (13th Edition)</a></h4><h5>₹699 onwards</h5></div>
<div class="blog-content"><div class="tags"><a>Date : Sunday 01 Nov 2026</a><a>06:00 AM</a></div><p>Location : Jhansi</p><h4><a href="https://example.com/jhansi">Jhansi Half Marathon</a></h4></div>`;

test('Thrill Zone parses dated local races and excludes other cities',()=>{
  const result=parseThrillZone(thrill,checkedAt);
  assert.equal(result.events.length,1);
  assert.equal(result.events[0].startAt,'2026-10-25T05:30:00+05:30');
  assert.equal(result.events[0].pricing.minPrice,699);
  assert.equal(result.events[0].venue.name,'Venue TBA');
  assert.equal(result.events[0].sources[0].provider,'thrillzone');
});

test('Thrill Zone fails closed if its upcoming section disappears',()=>{
  assert.throws(()=>parseThrillZone('<h1>Thrill Zone</h1>'),/section missing/);
});

test('Literature Festival publishes only a date-only festival, not invented sessions',()=>{
  const result=parseLiteratureFestival('<h1>Dehradun Literature Festival 2026</h1><p>NOV&nbsp; 27 - 29, 2026</p>',checkedAt);
  assert.equal(result.events.length,1);
  assert.equal(result.events[0].startAt,'2026-11-27');
  assert.equal(result.events[0].endAt,'2026-11-29');
  assert.equal(result.events[0].venue.name,'Venue TBA');
  assert.equal(result.diagnostics.sessionsParsed,0);
});

test('Literature Festival fails closed when official dates are absent',()=>{
  assert.throws(()=>parseLiteratureFestival('Dehradun Literature Festival'),/date range missing/);
});

const meetupEvent=(name,city,url)=>({
  '@context':'https://schema.org','@type':'Event',name,url,
  startDate:'2026-10-31T02:30:00.000Z',endDate:'2026-10-31T11:30:00.000Z',
  location:{'@type':'Place',name:'Graphic Era',address:{addressLocality:city,streetAddress:`Clement Town, ${city}`}}
});
const meetupHtml=(events)=>`<title>Events in Dehra Dun | Meetup</title><script type="application/ld+json">${JSON.stringify(events)}</script>`;

test('Meetup discovery accepts only local event URLs and venue cities',()=>{
  const result=parseMeetupDiscovery(meetupHtml([
    meetupEvent('AWS Student Community Day Dehradun 2026','Dehradun','https://www.meetup.com/aws-group/events/316766651/'),
    meetupEvent('Delhi event','Delhi','https://www.meetup.com/delhi/events/999/'),
    meetupEvent('Spoofed event','Dehradun','https://example.com/events/999/')
  ]),checkedAt);
  assert.equal(result.events.length,1);
  assert.equal(result.events[0].sources[0].externalId,'316766651');
  assert.equal(result.events[0].venue.city,'Dehradun');
});

test('Meetup discovery can succeed with zero current events',()=>{
  assert.equal(parseMeetupDiscovery(meetupHtml([]),checkedAt).events.length,0);
});
