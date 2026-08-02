import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createStarterConfig } from '../src/core/config.mjs';
import { inspectReadme } from '../src/core/doctor.mjs';
import { PROVIDER_IDS } from '../src/core/providers.mjs';
import { TEMPLATE_REGISTRY, getTemplate } from '../src/core/registry.mjs';
import { renderReadme } from '../src/core/render.mjs';
import { buildToPath, pathExists, readJson } from '../src/node/io.mjs';
import { validateConfig } from '../src/core/validate.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const failures = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (['.git', 'node_modules', 'dist', 'coverage'].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else files.push(target);
  }
  return files;
}

function fail(message) {
  failures.push(message);
}

const packageJson = await readJson(path.join(root, 'package.json'));
const changelog = await readFile(path.join(root, 'CHANGELOG.md'), 'utf8');
const license = await readFile(path.join(root, 'LICENSE'), 'utf8');
if (!changelog.includes(`## ${packageJson.version}`)
  && !changelog.includes(`## [${packageJson.version}]`)) {
  fail('CHANGELOG.md does not contain the package version');
}
if (!license.startsWith('BSD Zero Clause License')) fail('LICENSE is not the 0BSD license text');

const theme = await readJson(path.join(root, 'themes', 'midnight.json'));

const studioConfigPath = path.join(root, 'web', 'starter.config.json');
const studioConfig = await readJson(studioConfigPath);
const studioValidation = validateConfig(studioConfig);
studioValidation.errors.forEach((error) => fail(`Invalid Studio starter: ${error}`));
if (JSON.stringify(studioConfig).includes('../')) {
  fail('Studio starter contains a parent-relative path that will break in a repository-root README');
}
const studioTemplate = getTemplate(studioConfig.template);
const studioSource = await readFile(path.join(root, studioTemplate.path), 'utf8');
const studioOutput = renderReadme({
  templateSource: studioSource,
  config: studioConfig,
  theme,
  strict: true,
}).content;
if (/\]\(\.\.\//.test(studioOutput) || /(?:src|href)="\.\.\//.test(studioOutput)) {
  fail('Studio starter renders a parent-relative link that will break at the repository root');
}

for (const template of TEMPLATE_REGISTRY) {
  const templatePath = path.join(root, template.path);
  if (!await pathExists(templatePath)) {
    fail(`Missing registered template: ${template.path}`);
    continue;
  }
  const source = await readFile(templatePath, 'utf8');
  for (const provider of PROVIDER_IDS) {
    const config = createStarterConfig(template.kind);
    config.template = template.id;
    config.provider.id = provider;
    config.provider.mode = 'enhanced';
    try {
      const result = renderReadme({ templateSource: source, config, theme, strict: true });
      const report = inspectReadme(result.content, result.context);
      report.errors.forEach((error) => fail(`${template.id}/${provider}: ${error}`));
    } catch (error) {
      fail(`${template.id}/${provider}: ${error.message}`);
    }
  }
}

const examples = [
  { label: 'project', config: path.join(root, 'examples', 'project.config.json') },
  { label: 'profile', config: path.join(root, 'examples', 'profile.config.json') },
  { label: 'organization', config: path.join(root, 'examples', 'organization.config.json') },
];
for (const example of examples) {
  for (const provider of PROVIDER_IDS) {
    const outputPath = path.join(root, 'examples', 'generated', `${example.label}-${provider}.md`);
    if (!await pathExists(outputPath)) {
      fail(`Missing generated example: ${path.relative(root, outputPath)}`);
      continue;
    }
    const existing = await readFile(outputPath, 'utf8');
    const result = await buildToPath({
      configPath: example.config,
      outputPath,
      overrides: { provider },
      force: true,
      strict: true,
      write: false,
    });
    if (existing !== result.content) fail(`Stale generated example: ${path.relative(root, outputPath)}`);
  }
}

const readme = await readFile(path.join(root, 'README.md'), 'utf8');
const relativeLinks = [...readme.matchAll(/!?\[[^\]]*\]\((?!https?:|mailto:|#)([^)\s]+)(?:\s+"[^"]*")?\)/g)]
  .map((match) => match[1].split('#')[0])
  .filter(Boolean);
for (const link of relativeLinks) {
  if (!await pathExists(path.resolve(root, decodeURIComponent(link)))) fail(`Broken local README link: ${link}`);
}

for (const file of await walk(root)) {
  if (/\.(?:png|jpe?g|gif|zip)$/i.test(file)) continue;
  const content = await readFile(file, 'utf8');
  if (content.length > 0 && !content.endsWith('\n')) fail(`Missing final newline: ${path.relative(root, file)}`);
  if (/\t/.test(content) && !/\.svg$/i.test(file)) fail(`Tab character found: ${path.relative(root, file)}`);
}

if (failures.length > 0) {
  console.error(`Repository checks failed (${failures.length}):`);
  failures.forEach((message) => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log(`Repository checks passed: ${TEMPLATE_REGISTRY.length} templates × ${PROVIDER_IDS.length} providers, examples, links, and file hygiene.`);
}
