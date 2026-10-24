import test from 'node:test';
import assert from 'node:assert/strict';
import { detailsLinkLabel } from '../src/lib/sources.mjs';

const manual = (url) => ({ provider: 'manual', url });

test('a source listing keeps the "Tickets and details on <source>" label', () => {
  assert.equal(detailsLinkLabel({ provider: 'district', url: 'https://www.district.in/events/x' }), 'Tickets and details on District');
});

test('a hand-checked event names where its link goes, not doon.today', () => {
  assert.equal(detailsLinkLabel(manual('https://www.reddit.com/r/Dehradun/comments/1xdwqhx/x/')), 'Details in the r/Dehradun post');
  assert.equal(detailsLinkLabel(manual('https://old.reddit.com/r/Dehradun/comments/1/')), 'Details in the r/Dehradun post');
  assert.equal(detailsLinkLabel(manual('https://www.instagram.com/melophile.ddn/')), 'Details on Instagram');
  assert.equal(detailsLinkLabel(manual('https://tickets.example.com/show')), 'Details on tickets.example.com');
});

test('no link is shown for a review issue, or without a usable URL', () => {
  assert.equal(detailsLinkLabel(manual('https://github.com/srijan-kapoor/doon.today/issues/40')), null);
  assert.equal(detailsLinkLabel(manual('not a url')), null);
  assert.equal(detailsLinkLabel({ provider: 'manual' }), null);
  assert.equal(detailsLinkLabel(undefined), null);
});
