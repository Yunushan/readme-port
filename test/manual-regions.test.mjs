import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GENERATED_MARKER,
  extractManualRegions,
  inspectManualRegions,
  isGeneratedReadme,
  restoreManualRegions,
} from '../src/core/manual-regions.mjs';

const opening = '[readme-port-manual-start-notes]: # (readme-port:manual)';
const closing = '[readme-port-manual-end-notes]: # (/readme-port:manual)';

test('restores user content by manual region ID', () => {
  const previous = `${opening}\nkeep me\n${closing}`;
  const generated = `${opening}\ndefault\n${closing}`;
  assert.match(restoreManualRegions(generated, previous), /keep me/);
  assert.doesNotMatch(restoreManualRegions(generated, previous), /default/);
});

test('detects duplicate manual regions', () => {
  const duplicate = `${opening}\none\n${closing}\n${opening}\ntwo\n${closing}`;
  assert.throws(() => extractManualRegions(duplicate), /Duplicate manual region/);
  assert.equal(inspectManualRegions(duplicate).length, 1);
});

test('detects unbalanced region markers', () => {
  assert.equal(inspectManualRegions(opening).length, 1);
});

test('rejects nested and interleaved manual regions', () => {
  const openA = '[readme-port-manual-start-a]: # (readme-port:manual)';
  const closeA = '[readme-port-manual-end-a]: # (/readme-port:manual)';
  const openB = '[readme-port-manual-start-b]: # (readme-port:manual)';
  const closeB = '[readme-port-manual-end-b]: # (/readme-port:manual)';
  const nested = `${openA}\n${openB}\ninside\n${closeB}\n${closeA}`;
  const interleaved = `${openA}\n${openB}\n${closeA}\n${closeB}`;

  assert.ok(inspectManualRegions(nested).some((problem) => problem.includes('cannot be nested')));
  assert.ok(inspectManualRegions(interleaved).some((problem) => problem.includes('close out of order')));
  assert.throws(() => extractManualRegions(nested), /cannot be nested/);
  assert.throws(() => restoreManualRegions(nested, interleaved), /Cannot preserve manual content/);
});

test('rejects malformed manual region IDs', () => {
  const malformed = '[readme-port-manual-start-bad id]: # (readme-port:manual)\nvalue\n[readme-port-manual-end-bad id]: # (/readme-port:manual)';
  assert.ok(inspectManualRegions(malformed).some((problem) => problem.includes('Invalid manual region ID')));
  assert.throws(() => extractManualRegions(malformed), /Invalid manual region ID/);
});

test('rejects a closing marker that appears before its opening marker', () => {
  const reversed = '[readme-port-manual-end-a]: # (/readme-port:manual)\ncontent\n[readme-port-manual-start-a]: # (readme-port:manual)';
  assert.ok(inspectManualRegions(reversed).some((problem) => problem.includes('closes before it opens')));
  assert.throws(() => extractManualRegions(reversed), /closes before it opens/);
});

test('recognizes generated files', () => {
  assert.equal(isGeneratedReadme(`${GENERATED_MARKER}\n# Test`), true);
  assert.equal(isGeneratedReadme('# Hand written'), false);
});
