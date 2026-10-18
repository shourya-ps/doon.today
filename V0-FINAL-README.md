# doon.today — final V0 patch

This is the combined patch. It includes:

- stricter semantic geography validation
- removal of persisted false positives such as events explicitly advertised for Paris/France
- AllEvents-only records labelled source-reported rather than verified
- ingest health: healthy / degraded / failed
- retained previous-good events when a source transiently fails
- validation for geography and provenance
- fixes date-only events incorrectly rendering as 5:30 am
- date-only events display "Time TBA"
- all-day ICS handling
- per-event `.ics` download
- per-event Google Calendar action
- View source action on event detail pages
- existing site-wide `/calendar.ics` subscription preserved and corrected for all-day events

## Apply

From the doon.today repo root in Codespaces:

```bash
unzip -o doon-v0-final.zip
rm doon-v0-final.zip
git add .
git commit -m "fix: complete V0 curation and calendar actions"
git push origin main
```

Then run GitHub Actions → Refresh events → Run workflow once.

Netlify should redeploy automatically after the push / refresh commit.
