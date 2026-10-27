import test from 'node:test';
import assert from 'node:assert/strict';
import { geoFrom, isInDehradun } from '../ingest/lib/utils.mjs';
import { fetchDistrict } from '../ingest/sources/district.mjs';
import { fetchAllEvents, LIST } from '../ingest/sources/allevents.mjs';

const ldPage = (objects) => `<html><script type="application/ld+json">${JSON.stringify(objects)}</script></html>`;

test('coordinates are read as numbers from either source shape, and only kept inside Dehradun', () => {
  assert.deepEqual(geoFrom({ geo: { '@type': 'GeoCoordinates', latitude: 30.3129, longitude: 78.0534 } }), { lat: 30.3129, lng: 78.0534 }, 'District gives numbers');
  assert.deepEqual(geoFrom({ geo: { latitude: '30.323900', longitude: '78.051003' } }), { lat: 30.3239, lng: 78.051 }, 'AllEvents gives strings');
  assert.deepEqual(geoFrom({ geo: { latitude: 30.45989123, longitude: 78.06641987 } }), { lat: 30.45989, lng: 78.06642 }, 'Mussoorie is in; rounded to about a metre');
  assert.equal(geoFrom({ geo: { latitude: 28.6139, longitude: 77.209 } }), undefined, 'Delhi is out');
  assert.equal(geoFrom({ geo: { latitude: 43.3256, longitude: -83.7385 } }), undefined, 'Frankenmuth is out');
  assert.equal(geoFrom({ geo: { latitude: 0, longitude: 0 } }), undefined, '0,0 is a placeholder');
  assert.equal(geoFrom({ geo: { latitude: '', longitude: '' } }), undefined, 'empty strings are not 0');
  assert.equal(geoFrom({ geo: { latitude: 'n/a', longitude: 78 } }), undefined);
  assert.equal(geoFrom({ geo: { latitude: 30.3 } }), undefined, 'half a point is no point');
  assert.equal(geoFrom({ geo: 'Dehradun' }), undefined);
  assert.equal(geoFrom({}), undefined);
  assert.equal(geoFrom(undefined), undefined);
  assert.equal(isInDehradun({ lat: 30.3, lng: 78.0 }), true);
  assert.equal(isInDehradun({ lat: '30.3', lng: '78.0' }), false, 'stored coordinates must be numbers');
});

test('District and AllEvents events carry their venue coordinates', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const place = (name, geo) => ({ name, address: { addressLocality: 'Dehradun' }, ...(geo && { geo }) });
  globalThis.fetch = async (url) => Object.defineProperty(new Response(ldPage([
    { '@type': 'Event', name: 'Doon Music Night', startDate: '2030-11-01T18:00:00+05:30', url: 'https://www.district.in/events/a', location: place('Rajpur Road Hall', { latitude: 30.3431, longitude: 78.0482 }) },
    { '@type': 'Event', name: 'Doon Poetry Night', startDate: '2030-11-02T18:00:00+05:30', url: 'https://www.district.in/events/b', location: place('Cafe Dehradun') }
  ]), { status: 200 }), 'url', { value: url });
  const district = await fetchDistrict();
  assert.deepEqual(district.events.find((e) => e.title === 'Doon Music Night').venue.geo, { lat: 30.3431, lng: 78.0482 });
  assert.equal('geo' in district.events.find((e) => e.title === 'Doon Poetry Night').venue, false, 'no key at all when there are no coordinates');

  const listing = ldPage([{ '@type': 'Event', name: 'Framed In Crimson', startDate: '2030-10-31', url: 'https://allevents.in/dehradun/framed/1',
    location: { ...place('Hotel Vishranti: Dehradun'), geo: { '@type': 'GeoCoordinates', latitude: '30.360300', longitude: '78.071999' } } }]);
  const allevents = await fetchAllEvents({ fetchPage: async (url) => (url === LIST ? listing : ''), delayMs: 0 });
  assert.deepEqual(allevents.events[0].venue.geo, { lat: 30.3603, lng: 78.072 });
});
