import assert from 'node:assert/strict';
import test from 'node:test';

import { createStarterConfig } from '../src/core/config.mjs';
import { validateConfig } from '../src/core/validate.mjs';

test('accepts a complete starter configuration', () => {
  assert.deepEqual(validateConfig(createStarterConfig('project')).errors, []);
});

test('rejects malformed structural fields instead of dropping them', () => {
  const cases = [
    ['provider', 'github'],
    ['features', 'fast'],
    ['quickStart', { commands: 'npm start' }],
  ];
  for (const [field, value] of cases) {
    const config = createStarterConfig('project');
    config[field] = value;
    assert.ok(validateConfig(config).errors.length > 0, `${field} should be invalid`);
  }
});

test('warns when Bitbucket lacks an external support tracker', () => {
  const config = createStarterConfig('project');
  config.provider.id = 'bitbucket';
  config.provider.baseUrl = 'https://bitbucket.org';
  config.links.support = '';
  const report = validateConfig(config);
  assert.ok(report.warnings.some((warning) => warning.includes('2026-08-20')));
});

test('rejects incomplete or compositional provider base URLs', () => {
  for (const baseUrl of [
    'https://',
    'https://git.example.org?tenant=one',
    'https://git.example.org/#group',
    'https://user:secret@git.example.org',
    ' https://git.example.org',
    'https://git.example.org\\nested',
  ]) {
    const config = createStarterConfig('project');
    config.provider.baseUrl = baseUrl;
    assert.ok(validateConfig(config).errors.some((error) => error.startsWith('provider.baseUrl')));
  }

  const config = createStarterConfig('project');
  config.provider.baseUrl = 'https://git.example.org/forge';
  assert.deepEqual(validateConfig(config).errors, []);
});

test('rejects unsafe Markdown code language labels', () => {
  const cases = [
    ['quickStart', 'bash\n````'],
    ['installation', 'shell session'],
    ['usage', '`bash`'],
  ];
  for (const [field, language] of cases) {
    const config = createStarterConfig('project');
    if (field === 'quickStart') config.quickStart.language = language;
    else config[field] = [{ title: 'Example', language, code: 'echo safe' }];
    assert.ok(validateConfig(config).errors.some((error) => error.includes('.language')));
  }
});
