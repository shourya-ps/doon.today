import crypto from 'node:crypto';

export const IST = '+05:30';
export const nowIso = () => new Date().toISOString();
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export function slugify(input='') {
  return input.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90);
}
export function stableId(...parts) {
  return crypto.createHash('sha1').update(parts.filter(Boolean).join('|').toLowerCase()).digest('hex').slice(0, 16);
}
// Undoes one layer of HTML/XML escaping. Feeds like Reddit's Atom send a post's HTML escaped ("&lt;p&gt;"),
// so it has to be decoded before stripHtml can remove the tags. "&amp;" goes last so "&amp;lt;" stays "&lt;".
export function decodeEntities(s='') {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}
// Stand-ins sources use when they don't know the venue or have no real description. A merge never lets
// one of these replace a real value from another source of the same event.
const PLACEHOLDER_VENUE = /^\s*(?:venue\s*)?(?:tba|tbd|to be (?:announced|decided|confirmed))\s*[:,.\-–]?\s*(?:dehradun)?\s*$|^\s*see community post\s*$/i;
const PLACEHOLDER_DESCRIPTION = /\bcheck the organi[sz]er for\b/i;
export const isPlaceholderVenue = (name = '') => !String(name).trim() || PLACEHOLDER_VENUE.test(String(name));
export const isPlaceholderDescription = (text = '') => !String(text).trim() || PLACEHOLDER_DESCRIPTION.test(String(text));

export function stripHtml(s='') {
  const text = String(s).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/<[^>]*$/,' ');
  // Entities are decoded after the tags are gone, so an escaped "&lt;b&gt;" in the text stays text.
  return decodeEntities(text).replace(/[\u200b-\u200d\ufeff]/g,'').replace(/\s+/g,' ').trim();
}
/**
 * The price that schema.org offers give, in rupees, or null when they give none. Offers may be one object,
 * a list, or an AggregateOffer with its own list. The lowest real price wins; a higher one becomes the
 * range's top. An event is free only when every offer is 0, and a price in another currency is ignored
 * rather than shown as rupees.
 */
export function priceFromOffers(offers) {
  const list = flattenOffers(offers);
  const amount = (v) => {
    if (v === null || v === undefined || String(v).trim() === '') return null;
    const n = Number(String(v).replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : null;
  };
  const lows = [], highs = [];
  for (const o of list) {
    if (String(o.priceCurrency || 'INR').toUpperCase() !== 'INR') continue;
    for (const v of [o.price, o.lowPrice]) { const n = amount(v); if (n !== null) lows.push(n); }
    for (const v of [o.highPrice, o.price]) { const n = amount(v); if (n !== null) highs.push(n); }
  }
  if (!lows.length) return null;
  const top = Math.max(...lows, ...highs);
  const paid = lows.filter((n) => n > 0);
  if (!paid.length) return top === 0 ? { type: 'free', currency: 'INR' } : null;
  const minPrice = Math.round(Math.min(...paid));
  const maxPrice = Math.round(top);
  return { type: 'paid', minPrice, ...(maxPrice > minPrice ? { maxPrice } : {}), currency: 'INR' };
}
function flattenOffers(offers, out = []) {
  if (!offers) return out;
  if (Array.isArray(offers)) { offers.forEach((o) => flattenOffers(o, out)); return out; }
  if (typeof offers === 'object') { out.push(offers); if (offers.offers) flattenOffers(offers.offers, out); }
  return out;
}

/** A price stated in an event's own words: a rupee amount, or plainly a free event. Never a guess. */
export function priceFromText(text='') {
  const m = String(text).replace(/,/g,'').match(/(?:₹|Rs\.?|INR)\s*(\d+)/i);
  if (m) return {type:'paid', minPrice:Number(m[1]), currency:'INR'};
  if (/\bfree\s+(?:entry|event|admission|registration|of\s+cost)\b|\bentry\s+(?:is\s+)?free\b|\bit'?s\s+a\s+free\b/i.test(text)) return {type:'free', currency:'INR'};
  return {type:'unknown', currency:'INR'};
}

export function parseMoney(text='') {
  const m = text.replace(/,/g,'').match(/(?:₹|Rs\.?|INR)\s*(\d+)/i);
  if (/\bfree\b/i.test(text)) return {type:'free', currency:'INR'};
  return m ? {type:'paid', minPrice:Number(m[1]), currency:'INR'} : {type:'unknown', currency:'INR'};
}

// Terms are matched as whole words (see wordMatcher). Substring matching made "art" match "party",
// "goa" match "goat" and "paris" match "parish".
const DEHRADUN_TERMS = [
  'dehradun','dehra dun','rajpur','raipur road','dalanwala','hathibarkala','jakhan','malsi','clement town',
  'race course','kaulagarh','prem nagar','sahastradhara','ballupur','gms road',
  'clock tower','paltan bazaar','doon library','garhi cantt','niranjanpur','vikasnagar','maldevta'
];

// Raipur is a Dehradun locality and a city in Chhattisgarh, so only "Raipur Road" counts as Dehradun.
const OUTSIDE_TERMS = [
  'rishikesh','haridwar','roorkee','chandigarh','delhi','gurugram','noida','mumbai','bengaluru',
  'bangalore','pune','kolkata','jaipur','lucknow','hyderabad','chennai','goa','paris','france',
  'dubai','london','singapore','thailand','nepal','raipur','chhattisgarh'
];

const escapeRe = (term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');

// Whole-word (or whole-phrase) matcher; a trailing plural "s" is allowed.
export function wordMatcher(terms) {
  return new RegExp(`(?<![a-z0-9])(?:${terms.map(escapeRe).join('|')})s?(?![a-z0-9])`, 'i');
}

const DEHRADUN_RE = wordMatcher(DEHRADUN_TERMS);
const OUTSIDE_RE = wordMatcher(OUTSIDE_TERMS);

export function isDehradunText(text='') {
  return DEHRADUN_RE.test(text);
}

export function hasOutsideGeo(text='') {
  return OUTSIDE_RE.test(text);
}

export function isLikelyDehradunEvent({title='', description='', venueName='', address='', city=''}) {
  const semantic = `${title} ${description}`;
  const venue = `${venueName} ${address} ${city}`;

  // A structured city that names somewhere else wins over loose text matches.
  if (city && !isDehradunText(city) && hasOutsideGeo(city)) return false;
  if (hasOutsideGeo(semantic) && !isDehradunText(semantic)) return false;
  return isDehradunText(venue) || isDehradunText(semantic);
}

export function eventPassesGeo(e) {
  return isLikelyDehradunEvent({
    title: e?.title,
    description: e?.description,
    venueName: e?.venue?.name,
    address: e?.venue?.address,
    city: e?.venue?.city
  });
}

// Category rules, in display order. Terms are whole words; "tour" only counts when it is not a
// sightseeing tour. "Live shows" is a fallback for acts that give no other signal.
const CATEGORY_RULES = [
  ['Comedy', ['comedy','stand up','standup','stand-up','open mic']],
  ['Music', ['music','musical','concert','gig','live band','band','dj','unplugged','sufi','qawwali','karaoke']],
  ['Books', ['book','literature','poetry','reading','author']],
  ['Outdoors', ['run','running','walking','marathon','walk','hike','hiking','trek','trekking','bird','birding','cycling','cyclothon']],
  ['Art', ['art','paint','painting','exhibition','gallery']],
  ['Workshop', ['workshop','masterclass','training','ttc','bootcamp']],
  ['Wellness', ['yoga','zumba','meditation','retreat']],
  ['Film', ['film','cinema','screening']],
  ['Culture', ['dandiya','garba','rass','navratri','heritage','culture','folk','festival']],
  ['Food', ['food','feast','brunch','tasting','cuisine','all you can eat']],
  ['Community', ['meetup','community','social club']]
].map(([category, terms]) => [category, wordMatcher(terms)]);

export const CATEGORY_NAMES = [...CATEGORY_RULES.map(([category]) => category), 'Live shows', 'Other'];

const LIVE_RE = new RegExp(`(?<![a-z0-9])live(?![a-z0-9])|(?<!walking |heritage |city |food |bus |temple |village )(?<![a-z0-9])tours?(?![a-z0-9])`, 'i');

export function categoryFromText(text='') {
  const out = CATEGORY_RULES.filter(([, re]) => re.test(text)).map(([category]) => category);
  if (out.length === 0 && LIVE_RE.test(text)) out.push('Live shows');
  return out.length ? out : ['Other'];
}

// Neighbourhoods and roads of Dehradun, for the "area" shown on events and used by the area filter.
// Sources rarely give an area, so it is read from the address (or venue name) when they don't.
const AREAS = [
  ['Rajpur', ['rajpur road', 'rajpur']],
  ['Dalanwala', ['dalanwala']],
  ['Hathibarkala', ['hathibarkala']],
  ['Jakhan', ['jakhan']],
  ['Malsi', ['malsi']],
  ['Clement Town', ['clement town']],
  ['Race Course', ['race course']],
  ['Kaulagarh', ['kaulagarh']],
  ['Prem Nagar', ['prem nagar']],
  ['Sahastradhara', ['sahastradhara']],
  ['Ballupur', ['ballupur']],
  ['GMS Road', ['gms road']],
  ['Clock Tower', ['clock tower']],
  ['Paltan Bazaar', ['paltan bazaar']],
  ['Garhi Cantt', ['garhi cantt']],
  ['Niranjanpur', ['niranjanpur']],
  ['Vikasnagar', ['vikasnagar']],
  ['Maldevta', ['maldevta']]
].map(([name, terms]) => [name, wordMatcher(terms)]);

/** Area names, for the suggestions on the submit form. */
export const AREA_NAMES = AREAS.map(([name]) => name);

export function areaFromText(text = '') {
  return AREAS.find(([, re]) => re.test(text))?.[0];
}
