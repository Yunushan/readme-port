import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createStarterConfig } from '../src/core/config.mjs';
import { GENERATED_MARKER } from '../src/core/manual-regions.mjs';
import { renderReadme } from '../src/core/render.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const template = await readFile(path.join(root, 'templates/project/flagship.md.tmpl'), 'utf8');
const theme = JSON.parse(await readFile(path.join(root, 'themes/midnight.json'), 'utf8'));

test('renders enhanced GitHub output', () => {
  const config = createStarterConfig('project');
  const result = renderReadme({ templateSource: template, config, theme, strict: true });
  assert.ok(result.content.startsWith(GENERATED_MARKER));
  assert.match(result.content, /<div align="center">/);
  assert.match(result.content, /https:\/\/github\.com\/your-username\/your-project/);
});

test('falls back to portable Bitbucket output', () => {
  const config = createStarterConfig('project');
  config.provider.id = 'bitbucket';
  config.provider.mode = 'enhanced';
  const result = renderReadme({ templateSource: template, config, theme, strict: true });
  assert.doesNotMatch(result.content, /<div align=/);
  assert.doesNotMatch(result.content, /<!--/);
  assert.equal(result.context.provider.mode, 'portable');
  assert.ok(result.warnings.some((warning) => warning.includes('portable mode')));
});

test('preserves a manual region during regeneration', () => {
  const config = createStarterConfig('project');
  const first = renderReadme({ templateSource: template, config, theme, strict: true });
  const edited = first.content.replace(
    '[readme-port-manual-end-project-notes]: # (/readme-port:manual)',
    'Custom operator note.\n[readme-port-manual-end-project-notes]: # (/readme-port:manual)',
  );
  const second = renderReadme({
    templateSource: template,
    config,
    theme,
    previousContent: edited,
    strict: true,
  });
  assert.match(second.content, /Custom operator note\./);
});

test('rejects unsafe URL schemes', () => {
  const config = createStarterConfig('project');
  config.owner.website = 'javascript:alert(1)';
  assert.throws(
    () => renderReadme({ templateSource: template, config, theme, strict: true }),
    /unsafe URL scheme/,
  );
});

test('rejects unsafe and control-obfuscated support links', () => {
  for (const value of ['javascript:alert(1)', 'java\tscript:alert(1)', 'java&#x09;script:alert(1)', 'data:text/html,test']) {
    const config = createStarterConfig('project');
    config.links.support = value;
    assert.throws(
      () => renderReadme({ templateSource: template, config, theme, strict: true }),
      /unsafe URL scheme/,
    );
  }
});

test('resolves provider-aware quick-start tokens', () => {
  const config = createStarterConfig('project');
  const result = renderReadme({
    templateSource: template,
    config,
    theme,
    overrides: { provider: 'gitlab', mode: 'portable' },
    strict: true,
  });
  assert.match(result.content, /git clone https:\/\/gitlab\.com\/your-username\/your-project\.git/);
  assert.doesNotMatch(result.content, /github\.com\/your-username\/your-project/);
});

test('uses code fences longer than backtick runs in user code', () => {
  const config = createStarterConfig('project');
  config.quickStart.commands = ['printf \'```\\n\''];
  config.installation = [{ title: 'Fence', code: '````', language: 'text' }];
  config.usage = [{ title: 'Fence', code: '```', language: 'text' }];
  const result = renderReadme({ templateSource: template, config, theme, strict: true });

  assert.match(result.content, /````bash\nprintf '```\\n'\n````/);
  assert.match(result.content, /`````text\n````\n`````/);
  assert.match(result.content, /````text\n```\n````/);
});
