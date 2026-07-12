import { constants as fsConstants } from 'node:fs';
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectReadme } from '../core/doctor.mjs';
import { inspectManualRegions, isGeneratedReadme } from '../core/manual-regions.mjs';
import { PROVIDER_IDS } from '../core/providers.mjs';
import { getTemplate, getTheme } from '../core/registry.mjs';
import { renderReadme } from '../core/render.mjs';
import { validateConfig } from '../core/validate.mjs';

export const PROJECT_ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

export async function pathExists(target) {
  try {
    await access(target, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(target) {
  let content;
  try {
    content = await readFile(target, 'utf8');
  } catch (error) {
    throw new Error(`Cannot read ${target}: ${error.message}`);
  }
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON in ${target}: ${error.message}`);
  }
}

export async function writeAtomic(target, content) {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${process.pid}.${Date.now()}.tmp`,
  );
  await writeFile(temporary, content, 'utf8');
  await rename(temporary, target);
}

function resolveInside(base, requested, label) {
  const resolved = path.resolve(base, requested);
  const relative = path.relative(base, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside ${base}`);
  }
  return resolved;
}

export async function loadBuildInputs(configPath, overrides = {}) {
  const absoluteConfig = path.resolve(configPath);
  const config = await readJson(absoluteConfig);
  const configDirectory = path.dirname(absoluteConfig);
  const validation = validateConfig(config, overrides);
  if (validation.errors.length > 0) {
    const error = new Error(`Invalid configuration:\n- ${validation.errors.join('\n- ')}`);
    error.exitCode = 2;
    throw error;
  }

  const templateId = overrides.template ?? config.template;
  const templateMetadata = getTemplate(templateId);
  const templatePath = config.customTemplate
    ? resolveInside(configDirectory, config.customTemplate, 'customTemplate')
    : path.join(PROJECT_ROOT, templateMetadata.path);
  const themeMetadata = getTheme(config.theme || 'midnight');
  const themePath = path.join(PROJECT_ROOT, themeMetadata.path);

  const [templateSource, theme] = await Promise.all([
    readFile(templatePath, 'utf8'),
    readJson(themePath),
  ]);
  return {
    config,
    configPath: absoluteConfig,
    configDirectory,
    templateId,
    templateMetadata,
    templatePath,
    templateSource,
    theme,
    warnings: validation.warnings,
  };
}

export async function buildToPath({
  configPath,
  outputPath,
  overrides = {},
  force = false,
  strict = true,
  write = true,
}) {
  const inputs = await loadBuildInputs(configPath, overrides);
  const absoluteOutput = path.resolve(outputPath);
  const exists = await pathExists(absoluteOutput);
  const previousContent = exists ? await readFile(absoluteOutput, 'utf8') : '';

  if (exists && !isGeneratedReadme(previousContent) && !force) {
    const error = new Error(
      `Refusing to overwrite unrecognized file ${absoluteOutput}. Use --force once, or choose another --output.`,
    );
    error.exitCode = 3;
    throw error;
  }
  if (exists && isGeneratedReadme(previousContent)) {
    const markerProblems = inspectManualRegions(previousContent);
    if (markerProblems.length > 0) {
      const error = new Error(
        `Refusing to regenerate ${absoluteOutput} because manual regions are invalid:\n- ${markerProblems.join('\n- ')}`,
      );
      error.exitCode = 5;
      throw error;
    }
  }

  const rendered = renderReadme({
    templateSource: inputs.templateSource,
    config: inputs.config,
    theme: inputs.theme,
    previousContent,
    overrides,
    strict,
  });
  if (write) {
    await writeAtomic(absoluteOutput, rendered.content);
  }
  return { ...rendered, ...inputs, outputPath: absoluteOutput };
}

export async function buildAllProviders({
  configPath,
  outputDirectory,
  overrides = {},
  force = false,
  strict = true,
}) {
  const results = [];
  for (const provider of PROVIDER_IDS) {
    const outputPath = path.join(path.resolve(outputDirectory), provider, 'README.md');
    const result = await buildToPath({
      configPath,
      outputPath,
      overrides: { ...overrides, provider },
      force,
      strict,
    });
    results.push(result);
  }
  return results;
}

export async function diagnoseBuild({ configPath, outputPath, overrides = {} }) {
  const result = await buildToPath({
    configPath,
    outputPath,
    overrides,
    force: true,
    strict: true,
    write: false,
  });
  const report = inspectReadme(result.content, result.context);
  const baseDirectory = path.dirname(path.resolve(outputPath));
  for (const relativeLink of report.relativeLinks) {
    const clean = relativeLink.split('#')[0].split('?')[0];
    if (!clean || clean.startsWith('mailto:')) continue;
    let decoded;
    try {
      decoded = decodeURIComponent(clean);
    } catch {
      report.errors.push(`Local link is not valid percent-encoding: ${relativeLink}`);
      continue;
    }
    const target = path.resolve(baseDirectory, decoded);
    if (!await pathExists(target)) {
      report.warnings.push(`Local link target does not exist: ${relativeLink}`);
    }
  }
  return { ...result, report };
}

export async function ejectTemplate({ configPath, destination, force = false }) {
  const inputs = await loadBuildInputs(configPath);
  const configDirectory = path.dirname(path.resolve(configPath));
  const relativeDestination = destination
    || path.join('.readme-port', 'templates', `${inputs.templateId.replace('/', '-')}.md.tmpl`);
  const absoluteDestination = resolveInside(configDirectory, relativeDestination, 'Ejected template');
  if (await pathExists(absoluteDestination) && !force) {
    throw new Error(`Template already exists at ${absoluteDestination}; use --force to replace it`);
  }
  await mkdir(path.dirname(absoluteDestination), { recursive: true });
  await copyFile(inputs.templatePath, absoluteDestination);
  const portablePath = path.relative(configDirectory, absoluteDestination).split(path.sep).join('/');
  const updatedConfig = { ...inputs.config, customTemplate: portablePath };
  await writeAtomic(path.resolve(configPath), `${JSON.stringify(updatedConfig, null, 2)}\n`);
  return { destination: absoluteDestination, configPath: path.resolve(configPath) };
}

export async function fileSize(target) {
  return (await stat(target)).size;
}
