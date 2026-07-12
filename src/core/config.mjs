import { createProviderContext } from './providers.mjs';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function tableCell(value) {
  return String(value).replace(/\r?\n/g, ' ').replaceAll('|', '\\|');
}

function codeFence(value) {
  const runs = String(value).match(/`+/g) || [];
  const longest = runs.reduce((length, run) => Math.max(length, run.length), 0);
  return '`'.repeat(Math.max(3, longest + 1));
}

function withSeparators(items) {
  return items.map((item, index) => ({
    ...item,
    separator: index === items.length - 1 ? '' : ' · ',
  }));
}

function normalizeNavigation(items) {
  return withSeparators(asArray(items).map((item) => {
    if (typeof item === 'string') {
      const anchor = item.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return { label: item, url: `#${anchor}` };
    }
    const value = asObject(item);
    return {
      label: String(value.label ?? ''),
      url: value.url || (value.anchor ? `#${value.anchor}` : '#'),
    };
  }).filter((item) => item.label).map((item) => ({
    ...item,
    labelHtml: escapeHtml(item.label),
    urlHtml: escapeHtml(item.url),
  })));
}

function normalizeBadges(items) {
  return asArray(items).map((item) => {
    const value = asObject(item);
    return {
      alt: String(value.alt || value.label || 'badge'),
      image: String(value.image || ''),
      url: String(value.url || value.image || '#'),
    };
  }).filter((item) => item.image).map((item) => ({
    ...item,
    altHtml: escapeHtml(item.alt),
    imageHtml: escapeHtml(item.image),
    urlHtml: escapeHtml(item.url),
  }));
}

function normalizeList(items, mapper) {
  return asArray(items).map((item, index) => mapper(
    typeof item === 'string' ? { title: item } : asObject(item),
    index,
  ));
}

function normalizeTheme(theme = {}) {
  const value = asObject(theme);
  return {
    id: String(value.id || 'custom'),
    name: String(value.name || 'Custom'),
    accent: String(value.accent || '#6d5dfc'),
    secondary: String(value.secondary || '#22d3ee'),
    icon: String(value.icon || '◆'),
    iconHtml: escapeHtml(value.icon || '◆'),
    banner: String(value.banner || ''),
  };
}

export function normalizeConfig(config, theme, overrides = {}) {
  const provider = createProviderContext(config, overrides.provider, overrides.mode);
  const brandingSource = asObject(config.branding);
  const themeValue = normalizeTheme(theme);
  const ownerSource = asObject(config.owner);
  const repositorySource = asObject(config.repository);
  const quickStartSource = asObject(config.quickStart);
  const linksSource = asObject(config.links);
  const licenseSource = asObject(config.license);

  const navigation = config.options?.showTableOfContents === false
    ? []
    : normalizeNavigation(config.navigation);
  const features = normalizeList(config.features, (item) => ({
    title: tableCell(item.title || item.name || ''),
    description: tableCell(item.description || item.detail || ''),
  })).filter((item) => item.title);
  const stack = normalizeList(config.stack, (item) => ({
    name: tableCell(item.name || item.title || ''),
    detail: tableCell(item.detail || item.description || ''),
  })).filter((item) => item.name);
  const installation = normalizeList(config.installation, (item, index) => ({
    number: index + 1,
    title: String(item.title || `Step ${index + 1}`),
    description: String(item.description || ''),
    language: String(item.language || 'bash'),
    code: String(item.code || ''),
    fence: codeFence(item.code || ''),
  }));
  const usage = normalizeList(config.usage, (item) => ({
    title: String(item.title || 'Example'),
    description: String(item.description || ''),
    language: String(item.language || 'bash'),
    code: String(item.code || ''),
    fence: codeFence(item.code || ''),
  }));
  const configuration = normalizeList(config.configuration, (item) => ({
    key: tableCell(item.key || item.name || ''),
    required: item.required ? 'Yes' : 'No',
    default: item.default === undefined || item.default === null || item.default === ''
      ? '—'
      : tableCell(item.default),
    description: tableCell(item.description || ''),
  })).filter((item) => item.key);
  const roadmap = normalizeList(config.roadmap, (item) => ({
    title: String(item.title || ''),
    done: Boolean(item.done),
    mark: item.done ? 'x' : ' ',
  })).filter((item) => item.title);
  const skills = normalizeList(config.skills, (item) => ({
    name: tableCell(item.name || item.title || ''),
    detail: tableCell(item.detail || item.description || ''),
  })).filter((item) => item.name);
  const projects = normalizeList(config.projects, (item) => ({
    name: tableCell(item.name || item.title || ''),
    description: tableCell(item.description || ''),
    url: String(item.url || '#'),
    stack: tableCell(Array.isArray(item.stack) ? item.stack.join(' · ') : (item.stack || '')),
  })).filter((item) => item.name);
  const socials = withSeparators(normalizeList(config.socials, (item) => ({
    label: String(item.label || item.name || ''),
    url: String(item.url || '#'),
  })).filter((item) => item.label).map((item) => ({
    ...item,
    labelHtml: escapeHtml(item.label),
    urlHtml: escapeHtml(item.url),
  })));
  const commandValues = {
    '{{repository.url}}': provider.repositoryUrl,
    '{{repository.cloneUrl}}': provider.cloneUrl,
    '{{repository.issuesUrl}}': provider.issuesUrl,
    '{{repository.owner}}': String(repositorySource.owner || ownerSource.username || ''),
    '{{repository.name}}': provider.repositoryName,
  };
  const commands = asArray(quickStartSource.commands).map((command) => {
    let resolved = String(command);
    for (const [token, value] of Object.entries(commandValues)) {
      resolved = resolved.replaceAll(token, value);
    }
    return resolved;
  });

  return {
    schemaVersion: 1,
    kind: overrides.kind ?? config.kind,
    template: overrides.template ?? config.template,
    provider,
    modeEnhanced: provider.enhanced,
    modePortable: provider.portable,
    theme: themeValue,
    branding: {
      title: String(brandingSource.title || ''),
      titleHtml: escapeHtml(brandingSource.title || ''),
      tagline: String(brandingSource.tagline || ''),
      taglineHtml: escapeHtml(brandingSource.tagline || ''),
      logo: String(brandingSource.logo || ''),
      logoHtml: escapeHtml(brandingSource.logo || ''),
      banner: String(brandingSource.banner || themeValue.banner || ''),
    },
    owner: {
      name: String(ownerSource.name || repositorySource.owner || ''),
      nameHtml: escapeHtml(ownerSource.name || repositorySource.owner || ''),
      username: String(ownerSource.username || repositorySource.owner || ''),
      bio: String(ownerSource.bio || ''),
      location: String(ownerSource.location || ''),
      website: String(ownerSource.website || ''),
      email: String(ownerSource.email || ''),
      avatar: String(ownerSource.avatar || ''),
      avatarHtml: escapeHtml(ownerSource.avatar || ''),
    },
    repository: {
      owner: String(repositorySource.owner || ownerSource.username || ''),
      name: provider.repositoryName,
      defaultBranch: String(repositorySource.defaultBranch || 'main'),
      url: provider.repositoryUrl,
      cloneUrl: provider.cloneUrl,
      issuesUrl: provider.issuesUrl,
    },
    about: String(config.about || ownerSource.bio || ''),
    mission: String(config.mission || config.about || ''),
    badges: normalizeBadges(config.badges),
    navigation,
    features,
    stack,
    installation,
    usage,
    configuration,
    roadmap,
    skills,
    projects,
    socials,
    quickStart: {
      language: String(quickStartSource.language || 'bash'),
      code: commands.join('\n'),
      fence: codeFence(commands.join('\n')),
    },
    links: {
      documentation: String(linksSource.documentation || ''),
      demo: String(linksSource.demo || ''),
      support: String(linksSource.support || provider.issuesUrl || ''),
      security: String(linksSource.security || ''),
      contributing: String(linksSource.contributing || 'CONTRIBUTING.md'),
      license: String(linksSource.license || 'LICENSE'),
    },
    license: {
      name: String(licenseSource.name || 'MIT License'),
      spdx: String(licenseSource.spdx || 'MIT'),
      url: String(licenseSource.url || linksSource.license || 'LICENSE'),
    },
    custom: asObject(config.custom),
    options: {
      showTableOfContents: config.options?.showTableOfContents !== false,
      preserveManualRegions: config.options?.preserveManualRegions !== false,
      showProviderNote: config.options?.showProviderNote === true,
    },
  };
}

export function createStarterConfig(kind = 'project') {
  if (!['project', 'profile', 'organization'].includes(kind)) {
    throw new Error('kind must be project, profile, or organization');
  }
  const base = {
    $schema: 'https://raw.githubusercontent.com/Yunushan/readme-port/main/schema/readme-port.schema.json',
    schemaVersion: 1,
    kind,
    provider: { id: 'github', mode: 'enhanced', baseUrl: 'https://github.com' },
    theme: 'midnight',
    branding: {
      title: kind === 'profile' ? 'Your Name' : kind === 'organization' ? 'Your Organization' : 'Your Project',
      tagline: 'A short, specific promise that tells readers why this matters.',
      logo: '',
      banner: '',
    },
    repository: {
      owner: 'your-username',
      name: kind === 'profile' ? 'your-username' : 'your-project',
      defaultBranch: 'main',
    },
    owner: {
      name: 'Your Name',
      username: 'your-username',
      bio: 'What you build and who you help.',
      location: '',
      website: '',
      email: '',
    },
    about: 'Replace this with a clear two- or three-sentence overview.',
    badges: [],
    navigation: [
      { label: 'Quick start', anchor: 'quick-start' },
      { label: 'Documentation', anchor: 'documentation' },
      { label: 'Contributing', url: 'CONTRIBUTING.md' },
      { label: 'License', url: 'LICENSE' },
    ],
    features: [
      { title: 'Easy to adopt', description: 'Explain the first concrete benefit.' },
      { title: 'Built to last', description: 'Explain the second concrete benefit.' },
      { title: 'Portable', description: 'Explain where and how it works.' },
    ],
    stack: [
      { name: 'Technology', detail: 'Why it is used' },
    ],
    quickStart: {
      language: 'bash',
      commands: [
        'git clone {{repository.cloneUrl}}',
        'cd your-project',
        '# add your install and run commands',
      ],
    },
    installation: [],
    usage: [],
    configuration: [],
    roadmap: [
      { title: 'Publish the first stable release', done: false },
    ],
    skills: [
      { name: 'Area of expertise', detail: 'Tools and outcomes' },
    ],
    projects: [],
    socials: [],
    license: {
      name: 'MIT License',
      spdx: 'MIT',
      url: 'LICENSE',
    },
    custom: {},
    links: {
      documentation: '',
      demo: '',
      support: '',
      security: 'SECURITY.md',
      contributing: 'CONTRIBUTING.md',
      license: 'LICENSE',
    },
    options: {
      showTableOfContents: true,
      preserveManualRegions: true,
      showProviderNote: false,
    },
  };

  base.template = kind === 'profile'
    ? 'profile/professional'
    : kind === 'organization'
      ? 'organization/community'
      : 'project/flagship';
  return base;
}
