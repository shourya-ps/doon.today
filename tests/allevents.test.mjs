import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { priceFromOffers, priceFromText } from '../ingest/lib/utils.mjs';
import { addPricesFromEventPages, fetchAllEvents, priceFromEventPage } from '../ingest/sources/allevents.mjs';
import { mergeAndWrite } from '../ingest/merge.mjs';
import { priceLabel } from '../src/lib/sources.mjs';

const fixture = (name) => fs.readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const GHOSTED = 'https://allevents.in/dehradun/ghosted/4100030884279649';
const DANDIYA = 'https://allevents.in/dehradun/dandiya-night-dehradun-by-hindustan/3900030829381530';
const ZUMBA = 'https://allevents.in/dehradun/zumba-instructor-training-with-steve-frank-in-dehra-dun-uttarakhand-in/200030777510326';
const pages = async () => ({
  [GHOSTED]: await fixture('allevents-event-price-range.html'),
  [DANDIYA]: await fixture('allevents-event-offer-no-price.html'),
  [ZUMBA]: await fixture('allevents-event-no-offers.html')
});

test('offers give the lowest real price, the top of the range, and free only when everything is 0', () => {
  assert.deepEqual(priceFromOffers([{ '@type': 'AggregateOffer', priceCurrency: 'INR', lowPrice: '1500.00', highPrice: '4000.00', price: '1500.00' }]),
    { type: 'paid', minPrice: 1500, maxPrice: 4000, currency: 'INR' });
  assert.deepEqual(priceFromOffers({ price: '0', priceCurrency: 'INR' }), { type: 'free', currency: 'INR' });
  assert.deepEqual(priceFromOffers([{ price: 0 }, { price: 499 }]), { type: 'paid', minPrice: 499, currency: 'INR' }, 'a free tier beside paid ones is not "free"');
  assert.deepEqual(priceFromOffers({ '@type': 'AggregateOffer', offers: [{ price: '300' }, { price: '700' }] }), { type: 'paid', minPrice: 300, maxPrice: 700, currency: 'INR' });
  assert.equal(priceFromOffers({ priceCurrency: 'USD', price: '25' }), null, 'never shown as rupees');
  assert.equal(priceFromOffers({ priceCurrency: 'INR', price: '' }), null, 'an empty price is not 0');
  assert.equal(priceFromOffers(undefined), null);
});

test('a price in the text counts only when it is stated, never guessed from a stray "free"', () => {
  assert.deepEqual(priceFromText('Tickets ₹1,200 at the door'), { type: 'paid', minPrice: 1200, currency: 'INR' });
  assert.deepEqual(priceFromText("It's a FREE event! Bring friends."), { type: 'free', currency: 'INR' });
  assert.deepEqual(priceFromText('Free entry for all'), { type: 'free', currency: 'INR' });
  assert.equal(priceFromText('Free parking available at the venue').type, 'unknown');
  assert.equal(priceFromText('Feel free to bring a friend').type, 'unknown');
});

test('event pages fill in missing prices: a range, an offer without a price, and no offers', async () => {
  const html = await pages();
  const fetchPage = async (url) => { if (!html[url]) throw new Error(`unexpected ${url}`); return html[url]; };
  assert.deepEqual(await priceFromEventPage(GHOSTED, fetchPage), { type: 'paid', minPrice: 1500, maxPrice: 4000, currency: 'INR' });
  assert.equal(await priceFromEventPage(DANDIYA, fetchPage), null, 'its only offer is in USD with no price');
  assert.equal(await priceFromEventPage(ZUMBA, fetchPage), null);
  assert.equal(await priceFromEventPage('https://allevents.in/broken', async () => { throw new Error('403'); }), null, 'a failed page keeps the price unknown');
});

test('only unknown prices on AllEvents pages are fetched, one at a time and capped', async () => {
  const html = await pages();
  const fetched = [];
  const fetchPage = async (url) => { fetched.push(url); return html[url] || ''; };
  const ev = (url, pricing = { type: 'unknown', currency: 'INR' }) => ({ pricing, sources: [{ provider: 'allevents', url }] });
  const events = [ev(GHOSTED), ev(DANDIYA), ev(ZUMBA, { type: 'paid', minPrice: 900, currency: 'INR' }), ev('https://example.com/elsewhere')];
  const result = await addPricesFromEventPages(events, { fetchPage, delayMs: 0 });
  assert.deepEqual(result, { pricePagesFetched: 2, pricesFound: 1 });
  assert.deepEqual(fetched, [GHOSTED, DANDIYA], 'events with a price and non-AllEvents links are skipped');
  assert.equal(events[0].pricing.maxPrice, 4000);
  fetched.length = 0;
  await addPricesFromEventPages([ev(GHOSTED), ev(DANDIYA)], { fetchPage, delayMs: 0, max: 1 });
  assert.equal(fetched.length, 1);
});

test('fetchAllEvents reads the listing, then prices from event pages', async () => {
  const html = await pages();
  const listing = `<script type="application/ld+json">${JSON.stringify([
    { '@type': 'Event', name: 'Ghosted', startDate: '2026-10-31', url: GHOSTED, location: { name: 'BLAAZE - Mall of Dehradun', address: { addressLocality: 'Dehradun' } } },
    { '@type': 'Event', name: 'Dandiya Night Dehradun', startDate: '2026-10-25', url: DANDIYA, location: { name: 'Dehradun', address: { addressLocality: 'Dehradun' } } }
  ])}</script>`;
  const fetchPage = async (url) => (url === 'https://allevents.in/dehradun' ? listing : html[url] || '');
  const { events, diagnostics } = await fetchAllEvents({ fetchPage, delayMs: 0 });
  assert.equal(events.find((e) => e.title === 'Ghosted').pricing.minPrice, 1500);
  assert.equal(events.find((e) => e.title === 'Dandiya Night Dehradun').pricing.type, 'unknown');
  assert.equal(diagnostics.pricesFound, 1);
});

test('merged sources use the lowest price and the widest range; a known price beats unknown', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'doon-price-'));
  const cwd = process.cwd();
  process.chdir(dir);
  t.after(async () => { process.chdir(cwd); await fs.rm(dir, { recursive: true, force: true }); });
  const base = (over) => ({
    title: 'Dehradun Half Marathon 2030', startAt: '2030-10-25T05:30:00+05:30', venue: { name: 'Maharana Pratap Sports College', city: 'Dehradun' },
    categories: ['Outdoors'], curation: { status: 'published', score: 7 }, firstSeenAt: '2030-01-01T00:00:00Z', lastSeenAt: '2030-01-01T00:00:00Z', lastCheckedAt: '2030-01-01T00:00:00Z', ...over
  });
  await mergeAndWrite([
    { source: 'thrillzone', events: [base({ id: 'tz', slug: 'hm', pricing: { type: 'paid', minPrice: 699, currency: 'INR' }, sources: [{ provider: 'thrillzone', url: 'https://example.test/tz' }] })] },
    { source: 'allevents', events: [base({ id: 'ae', slug: 'hm', pricing: { type: 'paid', minPrice: 600, maxPrice: 1399, currency: 'INR' }, sources: [{ provider: 'allevents', url: 'https://example.test/ae' }] })] }
  ]);
  const [e] = JSON.parse(await fs.readFile('data/events.json', 'utf8'));
  assert.deepEqual(e.pricing, { type: 'paid', minPrice: 600, maxPrice: 1399, currency: 'INR' });
  assert.equal(e.sources[0].provider, 'thrillzone', 'the higher-ranked source still leads');

  await mergeAndWrite([
    { source: 'district', events: [base({ id: 'd', slug: 'x', title: 'Doon Gig 2030', pricing: { type: 'unknown', currency: 'INR' }, sources: [{ provider: 'district', url: 'https://example.test/d' }] })] },
    { source: 'allevents', events: [base({ id: 'a', slug: 'x', title: 'Doon Gig 2030', pricing: { type: 'paid', minPrice: 500, currency: 'INR' }, sources: [{ provider: 'allevents', url: 'https://example.test/a' }] })] }
  ]);
  const gig = JSON.parse(await fs.readFile('data/events.json', 'utf8')).find((x) => x.title === 'Doon Gig 2030');
  assert.deepEqual(gig.pricing, { type: 'paid', minPrice: 500, currency: 'INR' });
});

test('price labels for the event page and the list', () => {
  assert.equal(priceLabel({ type: 'paid', minPrice: 1500, maxPrice: 4000 }), '₹1,500–4,000');
  assert.equal(priceLabel({ type: 'paid', minPrice: 1500 }), 'From ₹1,500');
  assert.equal(priceLabel({ type: 'paid', minPrice: 1500, maxPrice: 4000 }, 'short'), '₹1,500+');
  assert.equal(priceLabel({ type: 'free' }), 'Free');
  assert.equal(priceLabel({ type: 'free' }, 'short'), 'FREE');
  assert.equal(priceLabel({ type: 'unknown' }), '');
});
