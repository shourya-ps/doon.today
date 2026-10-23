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
export function stripHtml(s='') {
  return s.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
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
  'clock tower','paltan bazaar','doon library','garhi cantt','niranjanpur','vikasnagar'
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
  ['Vikasnagar', ['vikasnagar']]
].map(([name, terms]) => [name, wordMatcher(terms)]);

/** Area names, for the suggestions on the submit form. */
export const AREA_NAMES = AREAS.map(([name]) => name);

export function areaFromText(text = '') {
  return AREAS.find(([, re]) => re.test(text))?.[0];
}
