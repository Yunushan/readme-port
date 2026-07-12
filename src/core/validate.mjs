import { getProviderDefinition, PROVIDER_IDS } from './providers.mjs';
import { TEMPLATE_REGISTRY, THEME_REGISTRY } from './registry.mjs';

const KINDS = ['project', 'profile', 'organization'];
const MODES = ['portable', 'enhanced'];
const TOP_LEVEL_FIELDS = new Set([
  '$schema', 'schemaVersion', 'kind', 'template', 'customTemplate', 'theme',
  'provider', 'branding', 'repository', 'owner', 'about', 'mission', 'badges',
  'navigation', 'features', 'stack', 'quickStart', 'installation', 'usage',
  'configuration', 'roadmap', 'skills', 'projects', 'socials', 'links',
  'license', 'custom', 'options',
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function unsafeUrl(value) {
  if (typeof value !== 'string') return false;
  if (/[\u0000-\u001f\u007f]/.test(value)
    || /[<>"']/.test(value)
    || /&(?:#[0-9]+|#x[0-9a-f]+|[a-z]+);/i.test(value)) return true;
  const canonical = value
    .trim()
    .replace(/&(?:tab|newline);/gi, '')
    .replace(/&#(?:x0*(?:9|a|d)|0*(?:9|10|13));?/gi, '');
  const scheme = canonical.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  return Boolean(scheme && !['http', 'https', 'mailto'].includes(scheme));
}

function validBaseUrl(value) {
  if (typeof value !== 'string' || value !== value.trim() || /[?#\\]/.test(value)) return false;
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol)
      && Boolean(parsed.hostname)
      && !parsed.username
      && !parsed.password;
  } catch {
    return false;
  }
}

function validCodeLanguage(value) {
  return typeof value === 'string' && /^[^\s`]+$/u.test(value);
}

function walkUrls(value, path, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkUrls(item, `${path}[${index}]`, errors));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    const urlLike = /url$/i.test(key)
      || path === 'links'
      || ['website', 'image', 'banner', 'logo', 'avatar'].includes(key);
    if (urlLike && typeof child === 'string' && unsafeUrl(child)) {
      errors.push(`${childPath} uses an unsafe URL scheme`);
    }
    walkUrls(child, childPath, errors);
  }
}

export function validateConfig(config, overrides = {}) {
  const errors = [];
  const warnings = [];
  if (!isObject(config)) {
    return { errors: ['Configuration must be a JSON object'], warnings };
  }

  if (config.schemaVersion !== 1) {
    errors.push('schemaVersion must be 1');
  }
  const unknownFields = Object.keys(config).filter((field) => !TOP_LEVEL_FIELDS.has(field));
  if (unknownFields.length > 0) {
    errors.push(`Unknown top-level fields: ${unknownFields.join(', ')}; put custom values under custom`);
  }

  const objectFields = ['branding', 'repository', 'owner', 'quickStart', 'links', 'options', 'license', 'custom'];
  for (const field of objectFields) {
    if (config[field] !== undefined && !isObject(config[field])) {
      errors.push(`${field} must be an object`);
    }
  }
  if (!isObject(config.provider)) {
    errors.push('provider must be an object');
  }

  const arrayFields = [
    'badges', 'navigation', 'features', 'stack', 'installation', 'usage',
    'configuration', 'roadmap', 'skills', 'projects', 'socials',
  ];
  for (const field of arrayFields) {
    if (config[field] !== undefined && !Array.isArray(config[field])) {
      errors.push(`${field} must be an array`);
    }
  }
  for (const field of ['features', 'stack', 'skills']) {
    if (Array.isArray(config[field]) && config[field].some((item) => typeof item !== 'string' && !isObject(item))) {
      errors.push(`${field} items must be strings or objects`);
    }
  }
  for (const field of ['badges', 'installation', 'usage', 'configuration', 'roadmap', 'projects', 'socials']) {
    if (Array.isArray(config[field]) && config[field].some((item) => !isObject(item))) {
      errors.push(`${field} items must be objects`);
    }
  }
  if (Array.isArray(config.navigation)
    && config.navigation.some((item) => typeof item !== 'string' && !isObject(item))) {
    errors.push('navigation items must be strings or objects');
  }
  if (isObject(config.quickStart)
    && config.quickStart.commands !== undefined
    && (!Array.isArray(config.quickStart.commands)
      || config.quickStart.commands.some((command) => typeof command !== 'string'))) {
    errors.push('quickStart.commands must be an array of strings');
  }
  if (isObject(config.quickStart)
    && config.quickStart.language !== undefined
    && !validCodeLanguage(config.quickStart.language)) {
    errors.push('quickStart.language must be one non-whitespace token without backticks');
  }
  for (const field of ['installation', 'usage']) {
    if (!Array.isArray(config[field])) continue;
    config[field].forEach((item, index) => {
      if (isObject(item) && item.language !== undefined && !validCodeLanguage(item.language)) {
        errors.push(`${field}[${index}].language must be one non-whitespace token without backticks`);
      }
    });
  }
  if (isObject(config.links)) {
    for (const [key, value] of Object.entries(config.links)) {
      if (typeof value !== 'string') errors.push(`links.${key} must be a string`);
    }
  }

  const kind = overrides.kind ?? config.kind;
  if (!KINDS.includes(kind)) {
    errors.push(`kind must be one of: ${KINDS.join(', ')}`);
  }

  const templateId = overrides.template ?? config.template;
  const template = TEMPLATE_REGISTRY.find((item) => item.id === templateId);
  if (!template) {
    errors.push(`template must be one of: ${TEMPLATE_REGISTRY.map((item) => item.id).join(', ')}`);
  } else if (template.kind !== kind) {
    errors.push(`template ${templateId} is for ${template.kind}, not ${kind}`);
  }

  const providerId = overrides.provider ?? (isObject(config.provider) ? config.provider.id : undefined);
  if (!PROVIDER_IDS.includes(providerId)) {
    errors.push(`provider.id must be one of: ${PROVIDER_IDS.join(', ')}`);
  }

  const mode = overrides.mode ?? (isObject(config.provider) ? config.provider.mode : undefined);
  if (!MODES.includes(mode)) {
    errors.push(`provider.mode must be one of: ${MODES.join(', ')}`);
  }

  if (isObject(config.provider) && config.provider.baseUrl && !validBaseUrl(config.provider.baseUrl)) {
    errors.push('provider.baseUrl must be a complete http(s) URL without credentials, query, or fragment');
  }

  if (config.theme && !THEME_REGISTRY.some((theme) => theme.id === config.theme)) {
    errors.push(`theme must be one of: ${THEME_REGISTRY.map((theme) => theme.id).join(', ')}`);
  }

  if (!isObject(config.branding) || !String(config.branding.title ?? '').trim()) {
    errors.push('branding.title is required');
  }

  if (kind === 'project' || kind === 'organization') {
    if (!String(config.repository?.owner ?? '').trim()) errors.push('repository.owner is required');
    if (!String(config.repository?.name ?? '').trim()) errors.push('repository.name is required');
  }

  if (kind === 'profile' && !String(config.owner?.username ?? '').trim()) {
    errors.push('owner.username is required for profile templates');
  }

  if (kind === 'profile' && providerId === 'bitbucket') {
    warnings.push('Bitbucket Cloud has no documented native profile README; the result will be a repository README');
  }
  if (providerId === 'bitbucket' && !String(isObject(config.links) ? config.links.support || '' : '').trim()) {
    warnings.push('Bitbucket Cloud Issues are scheduled for removal on 2026-08-20; set links.support to Jira or another external tracker');
  }
  if (mode === 'enhanced' && PROVIDER_IDS.includes(providerId) && !getProviderDefinition(providerId).supportsEnhancedLayout) {
    warnings.push(`${providerId} uses portable mode because enhanced raw-HTML layouts are not supported`);
  }
  if (['gitea', 'forgejo'].includes(providerId) && !(isObject(config.provider) && config.provider.baseUrl)) {
    warnings.push(`Set provider.baseUrl when targeting a self-hosted ${providerId} instance`);
  }

  walkUrls(config, '', errors);
  return { errors, warnings };
}

export class ConfigValidationError extends Error {
  constructor(errors) {
    super(`Invalid configuration:\n- ${errors.join('\n- ')}`);
    this.name = 'ConfigValidationError';
    this.errors = errors;
  }
}
