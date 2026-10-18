# doon.today

A semi-curated, text-first calendar of things happening in Dehradun, live at [doon.today](https://doon.today). It answers one question: **what can I do in Dehradun today or this weekend?**

The project is inspired by [blr.today](https://blr.today)'s calendar-first approach: a quiet page, honest labels about where each event came from, and calendar feeds you can subscribe to. It is not a ticket marketplace and has no accounts.

## What the site has

- A day-by-day event list with date, category, price and area filters. The selection lives in the URL, so a filtered view can be shared.
- An event page for each event with the source, when it was last checked, an "Add to calendar" file, a Google Calendar link and a "Report a problem" link.
- Calendar feeds under `/calendars`: everything, verified-only, free, one per category and one per source. `/calendar.ics` is the full feed.
- Open Graph tags and `Event` structured data, so shared links preview properly and search engines can read the events.
- A banner when the main source (District) has not refreshed recently. Readers can dismiss it; it returns if a different set of sources is affected.

## Quick start

You need Node 22.19 or newer (`.nvmrc` says 22).

```sh
npm ci
npm run dev        # http://localhost:4321
npm test           # unit tests (node --test)
npm run check      # astro check (types)
npm run build      # static site into dist/
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run ingest` | Fetch every source and rewrite `data/` (needs network) |
| `npm run ingest:primary` | Fetch District only |
| `npm run validate:data` | Check `data/events.json` for missing fields, duplicates and events outside Dehradun |
| `npm run check:health` | Fail if District has gone too long without a successful refresh |

`INGEST_ONLY=name1,name2` and `INGEST_SKIP=name1,name2` choose which sources `npm run ingest` runs. BookMyShow only runs when named in `INGEST_ONLY`.

## How the data flows

```
sources ──> ingest/sources/*.mjs ──> ingest/merge.mjs ──> data/events.json ──> Astro build ──> Netlify
 (adapters, one per source)   (match, merge, age out)   data/ingest-status.json
```

- **Adapters** (`ingest/sources/`) read one source each, mostly from the JSON-LD `Event` data on its pages. They fail closed: a page that loads but yields no events is recorded as a failure, not as a healthy empty fetch.
- **Merge** (`ingest/merge.mjs`) keeps only Dehradun events, merges the same event from several sources, keeps each event's id stable when its source moves it, and drops an event after three successful runs of its sources without it. It also fills in the neighbourhood from the address.
- **Status** (`data/ingest-status.json`) records, per source, the last attempt, the last success and the failure count. The site and the health check read it.
- **Static data** means the site has no server: every page is built from `data/` and deployed on each push to `main`.

Every event carries its sources, a verification status and when it was first seen, last seen and last checked. `verified` means a ticketing platform or the organizer lists it; `review` means only an aggregator (AllEvents) does and the site labels it "Source reported". Reddit posts never publish on their own; they go to `data/review/reddit.json`.

## Sources

| Source | Role | Status |
| --- | --- | --- |
| District | Main source, verified | Works from a home connection; blocks GitHub-hosted runners |
| Townscript, Virasat, Thrill Zone, Dehradun Literature Festival, Meetup | Ticketing and organizer pages, verified | Fetched by the hosted refresh |
| AllEvents | Aggregator, labelled "Source reported" | Fetched by the hosted refresh |
| r/Dehradun | Community leads for review | Fetched by the hosted refresh; never published directly |
| BookMyShow | Demoted | Cloudflare blocks it from every connection tried; off unless named in `INGEST_ONLY` |

The evidence and the options for District and BookMyShow are in [docs/primary-sources.md](docs/primary-sources.md).

## Refresh jobs

Event data is refreshed three times a day, at 06:00, 14:00 and 22:00 IST.

- **Refresh events** (`.github/workflows/refresh-events.yml`) runs on a GitHub-hosted runner: tests, every source except District, validation, build, then commits `data/` when it changed.
- **District** is fetched ten minutes earlier from a normal home connection, either by `scripts/refresh-primary-local.sh` (cron or launchd on your own machine) or by the self-hosted runner workflow `.github/workflows/refresh-primary.yml`. Setup, and the security notes for a self-hosted runner on a public repo, are in [docs/primary-sources.md](docs/primary-sources.md).

Both jobs share one concurrency group so they never commit at the same time.

## Health and alerts

A source counts as fresh for 36 hours after its last success (`PRIMARY_MAX_AGE_HOURS`). The last step of the hosted refresh runs `npm run check:health`, which turns the run red, and so sends GitHub's failure email, when District has gone 48 hours without a success (`HEALTH_MAX_AGE_HOURS`). A source that has never succeeded only produces a warning.

## Project layout

```
ingest/          adapters, merge and source-status logic
data/            events.json, ingest-status.json, review/reddit.json (committed)
src/pages/       pages, per-event and per-feed .ics endpoints
src/lib/         calendar (ics), feeds, sharing metadata, report links
src/components/  event row
scripts/         validation, health check, local District refresh
tests/           node:test suites and fixtures
docs/            notes on primary sources
```

## Reporting problems and contributing

Every event page has a "Report a problem" link that opens a prefilled GitHub issue. To suggest a missing event, [open an issue](https://github.com/srijan-kapoor/doon.today/issues/new). Pull requests are welcome; run `npm test`, `npm run check` and `npm run build` first.

## License

AGPL-3.0-or-later, matching the licensing approach of the blr.today website. See [LICENSE](LICENSE).
