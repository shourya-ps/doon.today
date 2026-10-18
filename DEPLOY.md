# Deploying doon.today from a phone

The application is intentionally static-first. Netlify builds the Astro site from GitHub; GitHub Actions refreshes event data every 8 hours and commits changes back to `main`, which triggers a new Netlify deployment.

## 1. Put this project into GitHub

If the ChatGPT GitHub connector cannot write to the repo, use a GitHub Codespace from your phone:

1. Download the `doon.today-mvp.zip` archive from the ChatGPT conversation to your phone.
2. Open `https://github.com/srijan-kapoor/doon.today` in your mobile browser.
3. Tap **Code → Codespaces → Create codespace on main**.
4. In the Codespace file explorer, upload the ZIP to the repository root.
5. Open the Codespace terminal and run:

   ```sh
   unzip -o doon.today-mvp.zip
   rm doon.today-mvp.zip
   git add .
   git commit -m "feat: initial doon.today MVP"
   git push origin main
   ```

The ZIP contains project files at its root, not inside an extra directory.

## 2. Confirm GitHub Actions

Open the repository **Actions** tab. The `Refresh events` workflow should appear.

Run it once manually with **Run workflow**. It will:

- fetch District, BookMyShow, AllEvents, Townscript and r/Dehradun;
- normalize and geofilter the results;
- keep Reddit-only event candidates in `data/review/reddit.json`;
- validate and build the site;
- commit `data/` only when the published snapshot changed.

The schedule is `00:30`, `08:30`, `16:30` UTC, corresponding to approximately **06:00, 14:00, 22:00 IST**.

## 3. Connect Netlify

1. In Netlify choose **Add new project → Import an existing project → GitHub**.
2. Select `srijan-kapoor/doon.today`.
3. Netlify should read `netlify.toml` automatically.
4. Deploy. Build command: `npm run build`; publish directory: `dist`.

No runtime environment variables are required for the MVP.

## 4. Add domains

In Netlify **Domain management**:

- add `doon.today` as the primary domain;
- add `dehradun.today` as a domain alias.

Then follow the DNS values Netlify provides in Namecheap. The checked-in `_redirects` file permanently redirects any request on `dehradun.today` to the same path on `doon.today` once both domains point to this Netlify site.

## 5. First production verification

Check:

- `/`
- `/calendars`
- `/calendar.ics`
- an `/events/<slug>/` page
- mobile layout
- source links
- `https://dehradun.today/...` redirects to `https://doon.today/...`

If the first refresh job finds zero current events, it intentionally fails rather than publishing an empty dataset. Inspect `data/ingest-status.json` and the Actions logs before changing source adapters.
