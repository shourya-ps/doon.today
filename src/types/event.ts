export type EventSourceProvider =
  | 'district'
  | 'bookmyshow'
  | 'allevents'
  | 'townscript'
  | 'virasat'
  | 'thrillzone'
  | 'literaturefestival'
  | 'meetup'
  | 'gdg'
  | 'reddit'
  | 'manual';

export interface EventSource {
  provider: EventSourceProvider;
  url: string;
  externalId?: string;
  checkedAt: string;
  confidence: number;
}

export interface EventRecord {
  id: string;
  slug: string;
  title: string;
  description?: string;
  startAt: string;
  endAt?: string;
  venue: {
    name: string;
    address?: string;
    area?: string;
    city: 'Dehradun';
    // From the source's structured data; only kept inside a rough box around Dehradun (geoFrom in ingest/lib/utils.mjs).
    geo?: { lat: number; lng: number };
    // 'table' when the coordinates came from data/venues.json rather than the source; re-derived on every run.
    geoFrom?: 'table';
  };
  categories: string[];
  pricing: {
    type: 'free' | 'paid' | 'unknown';
    minPrice?: number;
    // Set when tickets cost different amounts; the top of the range.
    maxPrice?: number;
    currency: 'INR';
  };
  sources: EventSource[];
  verificationStatus: 'verified' | 'community-reported' | 'review';
  curation: {
    status: 'published' | 'review' | 'rejected';
    score: number;
  };
  firstSeenAt: string;
  lastSeenAt: string;
  lastCheckedAt: string;
  // Successful runs of all of this event's sources in a row that did not list it; it is dropped at 3.
  missedRuns?: number;
  // Set when title, time or venue change; drive the calendar feeds' SEQUENCE and DTSTAMP.
  modifiedAt?: string;
  sequence?: number;
}
