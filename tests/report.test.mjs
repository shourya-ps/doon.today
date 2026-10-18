import test from 'node:test';
import assert from 'node:assert/strict';
import {reportEventUrl,suggestEventUrl,REPO_URL} from '../src/lib/report.mjs';

test('the report link opens a prefilled issue that identifies the event',()=>{
  const e={id:'abc123',title:'Doon Music Night & Friends',sources:[{url:'https://example.test/e'}]};
  const url=new URL(reportEventUrl(e,'https://doon.today/events/doon-music-night/'));
  assert.equal(url.origin+url.pathname,`${REPO_URL}/issues/new`);
  assert.equal(url.searchParams.get('title'),'Problem with event: Doon Music Night & Friends');
  const body=url.searchParams.get('body');
  assert.match(body,/Event id: abc123/);
  assert.match(body,/Page: https:\/\/doon\.today\/events\/doon-music-night\//);
  assert.match(body,/Source: https:\/\/example\.test\/e/);
});

test('the suggest link opens a new-issue form with prompts',()=>{
  const url=new URL(suggestEventUrl());
  assert.equal(url.searchParams.get('title'),'Missing event: ');
  assert.match(url.searchParams.get('body'),/Venue/);
});
