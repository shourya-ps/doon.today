# Primary sources (District, BookMyShow)

District and BookMyShow return `403 Forbidden` to GitHub-hosted runners. See
[bug-report-primary-sources-403.md](bug-report-primary-sources-403.md) for the evidence. This project does
not spoof a browser, solve CAPTCHAs or use stealth tooling, so request headers are not the lever. Where the
block is on datacenter IPs, the fix is to fetch from a machine on a normal connection.

| Source | GitHub-hosted runner | Home/ISP connection | Plan |
| --- | --- | --- | --- |
| District | `403` | `200`, 12 candidate events parsed (18 Oct 2026) | self-hosted runner or local script, below |
| BookMyShow | `403` (Cloudflare) | **still `403`** to a plain `curl` and to `fetch` from a Mac, though a browser renders the page | **not fixed by moving the job.** Needs permission or a feed from BookMyShow (below) |

**BookMyShow.** Cloudflare rejects plain HTTP clients even from a residential IP, so running the adapter
elsewhere does not help. The compliant routes are an approved partner, organizer or calendar feed from
BookMyShow, or demoting it from primary to a secondary source until one exists. The adapter keeps running
in the primary job so it recovers on its own if access changes, and its failure is recorded without
breaking the run. Until then the home page banner will keep naming BookMyShow as stale.

| Job | Where it runs | Sources |
| --- | --- | --- |
| `Refresh events` (`refresh-events.yml`) | GitHub-hosted `ubuntu-24.04` | everything except District and BookMyShow (`INGEST_SKIP`) |
| `Refresh primary sources` (`refresh-primary.yml`) | self-hosted runner labelled `doon-primary` | District and BookMyShow only (`INGEST_ONLY`) |

Both jobs share one concurrency group, so they never commit at the same time. Each job only updates the
sources it ran and keeps the other sources' entries in `data/ingest-status.json`.

## Option A: self-hosted runner

1. Repo **Settings → Actions → Runners → New self-hosted runner**, pick your OS, and run the commands
   GitHub shows. When `./config.sh` asks for extra labels, enter `doon-primary`.
2. Install it as a service so it survives restarts: `./svc.sh install && ./svc.sh start` (macOS and Linux).
3. Needs Node 22+ (`.nvmrc`) and git on that machine. The machine has to be on around 05:50, 13:50 and
   21:50 IST; a job queued while the runner is offline waits and is dropped after 24 hours.
4. Trigger it once from **Actions → Refresh primary sources → Run workflow** and check the log.

**Security.** The repository is public and a self-hosted runner runs workflow code on your machine.
`refresh-primary.yml` only has `schedule` and `workflow_dispatch` triggers, which fork contributors cannot
fire. Do not add `pull_request`, `pull_request_target` or `issue_comment` triggers to it. In **Settings →
Actions → General**, set "Fork pull request workflows" to require approval for all outside collaborators.

## Option B: cron or launchd on your own machine

`scripts/refresh-primary-local.sh` does the same job with your own git credentials: pull, test, fetch
District and BookMyShow, validate, commit `data/`, push. Try it first with `DRY_RUN=1`. Example crontab
(times are local; this one assumes the machine is on IST):

```
20 6,14,22 * * * cd /path/to/doon.today && ./scripts/refresh-primary-local.sh >> ~/doon-primary.log 2>&1
```

## Detecting trouble

- `data/ingest-status.json` records `lastAttemptAt`, `lastSuccessAt` and `consecutiveFailures` per source,
  plus `primarySources` with each primary source's age and whether it counts as fresh (36h by default,
  `PRIMARY_MAX_AGE_HOURS`).
- The home page banner names the stale source and when it last refreshed.
- The last step of `Refresh events` runs `npm run check:health`. It fails the run when a primary source that
  has refreshed before has gone 48h without a success (`HEALTH_MAX_AGE_HOURS`), and GitHub emails you about a
  failed scheduled workflow. A source that has never succeeded (BookMyShow today) only raises a warning
  annotation, so it does not keep every run red.
- A `200` response that yields no events (a challenge page, changed markup) is recorded as a failure, not
  as `ok`.

## Running a single source locally

```
INGEST_ONLY=district,bookmyshow npm run ingest   # only these sources
INGEST_SKIP=district,bookmyshow npm run ingest   # everything else
```
