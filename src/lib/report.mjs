// "Report a problem" links. Reports go to GitHub issues for now, prefilled with what a fix needs.
export const REPO_URL = 'https://github.com/srijan-kapoor/doon.today';

/** A prefilled new-issue link for a wrong or missing detail on one event. */
export function reportEventUrl(e, pageUrl) {
  const body = [
    '**What is wrong?**',
    '',
    '<!-- Describe what the page says and what is correct, ideally with a link to the organizer. -->',
    '',
    '---',
    `Event: ${e.title}`,
    `Page: ${pageUrl}`,
    `Event id: ${e.id}`,
    `Source: ${e.sources?.[0]?.url ?? 'unknown'}`
  ].join('\n');
  const params = new URLSearchParams({ title: `Problem with event: ${e.title}`, body });
  return `${REPO_URL}/issues/new?${params.toString()}`;
}

/** A prefilled new-issue link for an event that is missing from the site. */
export function suggestEventUrl() {
  const body = ['**Event name, date and time:**', '', '**Venue:**', '', '**Link to the organizer or tickets:**', ''].join('\n');
  return `${REPO_URL}/issues/new?${new URLSearchParams({ title: 'Missing event: ', body }).toString()}`;
}
