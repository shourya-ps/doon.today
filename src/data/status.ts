import rawStatus from '../../data/ingest-status.json';

export type IngestHealth = 'healthy' | 'degraded' | 'failed';

export const ingestStatus = rawStatus as {
  ranAt: string;
  health?: IngestHealth;
  primarySourcesAvailable?: string[];
  primarySourcesExpected?: string[];
  sources?: Record<string, {status: 'ok' | 'failed'}>;
};
