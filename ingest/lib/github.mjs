// A small GitHub REST client for the review queue. In a workflow, GITHUB_TOKEN and GITHUB_REPOSITORY are
// set by Actions; issues opened with that token are authored by github-actions[bot], so the repo owner
// gets a notification for each one.
export function github({ token = process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPOSITORY, fetchImpl = fetch } = {}) {
  if (!token || !repo) throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY are needed');
  async function call(method, path, body) {
    const res = await fetchImpl(`https://api.github.com/repos/${repo}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
    return res.status === 204 ? null : res.json();
  }
  return {
    call,
    /** Every issue with the label, open or closed, oldest pages first. Pull requests are left out. */
    async issuesWithLabel(label) {
      const all = [];
      for (let page = 1; page <= 20; page++) {
        const batch = await call('GET', `/issues?labels=${encodeURIComponent(label)}&state=all&per_page=100&page=${page}`);
        all.push(...batch.filter((i) => !i.pull_request));
        if (batch.length < 100) break;
      }
      return all;
    },
    comment: (number, body) => call('POST', `/issues/${number}/comments`, { body }),
    close: (number, reason = 'completed') => call('PATCH', `/issues/${number}`, { state: 'closed', state_reason: reason }),
    removeLabel: (number, label) => call('DELETE', `/issues/${number}/labels/${encodeURIComponent(label)}`).catch(() => null)
  };
}
