import {fetchText} from '../lib/http.mjs';
import {eventLikeObjects} from '../lib/jsonld.mjs';
import {stableId,slugify,stripHtml,nowIso,categoryFromText} from '../lib/utils.mjs';

const DISCOVERY='https://www.meetup.com/find/in--dehra-dun/';

export function parseMeetupDiscovery(html,checkedAt=nowIso()) {
  if(!/Events in Dehra Dun\s*\|\s*Meetup/i.test(html)) throw new Error('Meetup Dehra Dun discovery page missing');
  const candidates=eventLikeObjects(html);
  const events=[];
  for(const item of candidates) {
    const location=item.location||{};
    const address=location.address||{};
    const city=address.addressLocality||'';
    if(!/^dehra\s*dun$/i.test(city) && !/^dehradun$/i.test(city)) continue;
    if(item.eventAttendanceMode?.includes('Online') || item.eventStatus?.includes('Cancelled')) continue;
    if(!item.name || !item.startDate || !item.url) continue;
    const url=new URL(item.url,DISCOVERY);
    if(!/(^|\.)meetup\.com$/i.test(url.hostname) || !/\/events\/\d+/.test(url.pathname)) continue;
    if(Number.isNaN(Date.parse(item.startDate))) continue;
    const title=stripHtml(item.name);
    const startAt=item.startDate;
    events.push({
      id:stableId('meetup',url.pathname),slug:slugify(title),title,
      description:stripHtml(item.description||'Meetup event in Dehradun. Check the organizer page for the latest details.'),
      startAt,...(item.endDate && !Number.isNaN(Date.parse(item.endDate)) ? {endAt:item.endDate} : {}),
      venue:{name:stripHtml(location.name||'Venue TBA'),address:stripHtml(address.streetAddress||''),city:'Dehradun'},
      categories:categoryFromText(title+' '+(item.description||'')),pricing:{type:'unknown',currency:'INR'},
      sources:[{provider:'meetup',url:url.href,externalId:url.pathname.match(/\/events\/(\d+)/)?.[1],checkedAt,confidence:.9}],
      verificationStatus:'verified',curation:{status:'published',score:6},
      firstSeenAt:checkedAt,lastSeenAt:checkedAt,lastCheckedAt:checkedAt
    });
  }
  return {source:'meetup',events,diagnostics:{candidates:candidates.length,eventsParsed:events.length}};
}

export async function fetchMeetup() { return parseMeetupDiscovery(await fetchText(DISCOVERY)); }
