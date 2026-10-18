export type EventSourceProvider =
  | 'district'
  | 'bookmyshow'
  | 'allevents'
  | 'townscript'
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
  };
  categories: string[];
  pricing: {
    type: 'free' | 'paid' | 'unknown';
    minPrice?: number;
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
}
