// Review community leads: approve a post to publish it as a hand-checked event, or reject it for good.
//
//   npm run review            go through the leads one by one
//   npm run review -- --list  only print the leads waiting for review
//
// Approving writes data/curated-events.json, every choice is recorded in data/review/decisions.json, and
// data/events.json is rebuilt straight away. Nothing is published until the change is committed and pushed.
import readline from 'node:readline/promises';
import { execFileSync } from 'node:child_process';
import { stdin as input, stdout as output } from 'node:process';
import {
  readJson, writeJson, pendingCandidates, parseWhen, parsePrice, buildCuratedEvent, approve, reject,
  QUEUE_PATH, DECISIONS_PATH, CURATED_PATH
} from '../ingest/lib/review.mjs';
import { mergeAndWrite } from '../ingest/merge.mjs';
import { CATEGORY_NAMES, categoryFromText } from '../ingest/lib/utils.mjs';

const istText = (iso) => {
  const t = Date.parse(iso || '');
  return Number.isFinite(t) ? new Date(t + 5.5 * 3600_000).toISOString().slice(0, 16).replace('T', ' ') : '';
};
const show = (c, i, n) => {
  console.log(`\n── Lead ${i + 1} of ${n} ${'─'.repeat(40)}`);
  console.log(c.title);
  console.log(`Date guessed from the post: ${istText(c.startAt) || 'none'} (the time is usually a guess)`);
  console.log(`Post: ${c.sources?.[0]?.url}`);
  if (c.description) console.log(`\n${c.description.slice(0, 600)}${c.description.length > 600 ? '…' : ''}`);
};

const queue = await readJson(QUEUE_PATH, []);
let decisions = await readJson(DECISIONS_PATH, {});
let curated = await readJson(CURATED_PATH, []);
const pending = pendingCandidates(queue, decisions);

if (pending.length === 0) {
  console.log('No leads are waiting for review.');
  process.exit(0);
}
if (process.argv.includes('--list')) {
  pending.forEach((c, i) => show(c, i, pending.length));
  process.exit(0);
}

const rl = readline.createInterface({ input, output });
const ask = async (label, fallback = '') => {
  const answer = (await rl.question(fallback ? `${label} [${fallback}]: ` : `${label}: `)).trim();
  return answer || fallback;
};
const askValid = async (label, fallback, check, hint) => {
  for (;;) {
    const value = await ask(label, fallback);
    if (check(value)) return value;
    console.log(`  ${hint}`);
  }
};

let changed = 0;
try {
  for (const [i, c] of pending.entries()) {
    show(c, i, pending.length);
    const choice = (await ask('\n[a]pprove, [r]eject, [s]kip, [q]uit', 's')).toLowerCase()[0];
    if (choice === 'q') break;
    if (choice === 'r') {
      ({ decisions, curated } = reject({ decisions, curated }, c, await ask('Why? (optional note)')));
      changed++;
      console.log('Rejected. It will not come back.');
      continue;
    }
    if (choice !== 'a') continue;

    const title = await ask('Title', c.title);
    const when = await askValid('Starts, IST (YYYY-MM-DD HH:mm, or YYYY-MM-DD for all day)', istText(c.startAt), (v) => parseWhen(v), 'Use 2026-11-02 18:30 or 2026-11-02.');
    const endWhen = await askValid('Ends (optional, same format)', '', (v) => v === '' || parseWhen(v), 'Use 2026-11-02 21:00, or leave empty.');
    const venue = await askValid('Venue name', '', (v) => v !== '', 'A venue is needed.');
    const address = await ask('Address (optional)');
    const price = await askValid('Price: free, an amount in rupees, or unknown', 'unknown', (v) => parsePrice(v), 'Use free, 500 or unknown.');
    const guess = categoryFromText(`${title} ${c.description || ''}`);
    const cats = await ask(`Categories, comma separated (${CATEGORY_NAMES.join(', ')})`, guess.join(', '));
    const url = await ask('Link for details', c.sources?.[0]?.url);
    try {
      const event = buildCuratedEvent(c, { title, when, endWhen: endWhen || undefined, venue, address, price, url, categories: cats.split(',').map((s) => s.trim()).filter(Boolean) });
      console.log(`\nWill publish: ${event.title}\n  ${event.startAt}${event.endAt ? ` to ${event.endAt}` : ''} at ${event.venue.name}\n  ${event.categories.join(', ')} · ${event.pricing.type}`);
      if ((await ask('Publish this? [y/n]', 'y')).toLowerCase()[0] !== 'y') { console.log('Skipped.'); continue; }
      ({ decisions, curated } = approve({ decisions, curated }, c, event));
      changed++;
      console.log('Approved.');
    } catch (error) {
      console.log(`  Could not use that: ${error.message}. Skipped.`);
    }
  }

  if (changed === 0) {
    console.log('\nNo changes.');
  } else {
    await writeJson(DECISIONS_PATH, decisions);
    await writeJson(CURATED_PATH, curated);
    const counts = await mergeAndWrite([]);
    console.log(`\nSaved. ${counts.published} events are published, ${counts.review} leads still wait for review.`);
    execFileSync('node', ['scripts/validate-data.mjs'], { stdio: 'inherit' });

    const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
    const onMain = git('rev-parse', '--abbrev-ref', 'HEAD') === 'main';
    const elsewhere = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).split('\n').filter((l) => l && !l.slice(3).startsWith('data/'));
    if (!onMain || elsewhere.length) {
      console.log('\nTo publish: commit data/ on main and push.');
    } else if ((await ask('\nCommit and push to main now so it goes live? [y/n]', 'n')).toLowerCase()[0] === 'y') {
      git('add', 'data/');
      git('commit', '-m', 'data: review community leads');
      git('pull', '--rebase', 'origin', 'main');
      git('push', 'origin', 'main');
      console.log('Pushed. The site updates when Netlify finishes the deploy.');
    } else {
      console.log('Not pushed. Commit data/ on main and push when ready.');
    }
  }
} finally {
  rl.close();
}
