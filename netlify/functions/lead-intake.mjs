// Runs when Netlify verifies a submit-form entry (spam is filtered out before this). It starts the
// "Open lead issue" workflow with the entry, minus contact details, so the review issue is opened by
// github-actions[bot] and notifies the repo owner.
//
// Needs, in Netlify's production environment variables:
//   DOON_GITHUB_TOKEN  a fine-grained token for this repo with only "Actions: read and write"
//   DOON_GITHUB_REPO   optional, defaults to srijan-kapoor/doon.today
import { dispatchLead } from '../../ingest/lib/dispatch-lead.mjs';

export default {
  async formSubmitted(event) {
    console.log(`lead-intake: ${await dispatchLead(event?.data || {})}`);
  }
};
