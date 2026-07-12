import assert from 'node:assert/strict';
import test from 'node:test';

import { inspectReadme } from '../src/core/doctor.mjs';

const bitbucketContext = {
  provider: { id: 'bitbucket' },
  modePortable: true,
};

test('doctor detects common raw HTML tags in portable output', () => {
  for (const tag of ['<h1>Title</h1>', '<a href="docs/">Docs</a>', '<span>Label</span>']) {
    const report = inspectReadme(tag, bitbucketContext);
    assert.ok(report.errors.some((error) => error.includes('raw HTML')));
  }
});

test('doctor ignores HTML and links shown as code', () => {
  const content = [
    '````html',
    '<h1>Example</h1>',
    '[private](internal.md)',
    '```',
    '````',
    '',
    '`<span>inline example</span>`',
  ].join('\n');
  const report = inspectReadme(content, bitbucketContext);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.relativeLinks, []);
});
