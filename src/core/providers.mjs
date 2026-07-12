const PROVIDER_DEFINITIONS = {
  portable: {
    name: 'Portable Markdown',
    defaultBaseUrl: '',
    profileSupport: 'portable-content',
    profilePath: 'README.md in a repository of your choice',
    organizationProfilePath: 'README.md in an organization repository of your choice',
    supportsRawHtml: false,
    supportsEnhancedLayout: false,
    supportsNativeProfile: false,
  },
  github: {
    name: 'GitHub',
    defaultBaseUrl: 'https://github.com',
    profileSupport: 'native',
    profilePath: 'README.md in a public repository named exactly like your username',
    organizationProfilePath: 'profile/README.md in a public organization repository named .github',
    supportsRawHtml: true,
    supportsEnhancedLayout: true,
    supportsNativeProfile: true,
  },
  gitlab: {
    name: 'GitLab',
    defaultBaseUrl: 'https://gitlab.com',
    profileSupport: 'native',
    profilePath: 'README.md in a public, case-sensitive username/username project',
    organizationProfilePath: 'root README.md in the group project named gitlab-profile',
    supportsRawHtml: true,
    supportsEnhancedLayout: true,
    supportsNativeProfile: true,
  },
  gitea: {
    name: 'Gitea',
    defaultBaseUrl: 'https://gitea.com',
    profileSupport: 'native',
    profilePath: 'root README.md in a public repository named .profile',
    organizationProfilePath: 'root README.md in the organization repository named .profile',
    supportsRawHtml: false,
    supportsEnhancedLayout: false,
    supportsNativeProfile: true,
  },
  forgejo: {
    name: 'Forgejo',
    defaultBaseUrl: 'https://codeberg.org',
    profileSupport: 'native',
    profilePath: 'root README.md in a public, non-fork repository named .profile',
    organizationProfilePath: 'root README.md in the organization repository named .profile',
    supportsRawHtml: false,
    supportsEnhancedLayout: false,
    supportsNativeProfile: true,
  },
  bitbucket: {
    name: 'Bitbucket Cloud',
    defaultBaseUrl: 'https://bitbucket.org',
    profileSupport: 'repository-only',
    profilePath: 'No documented native profile README; use the output as a repository README',
    organizationProfilePath: 'No documented native organization profile README; use a repository README',
    supportsRawHtml: false,
    supportsEnhancedLayout: false,
    supportsNativeProfile: false,
  },
};

export const PROVIDER_IDS = Object.freeze(Object.keys(PROVIDER_DEFINITIONS));

function trimSlash(value = '') {
  return String(value).replace(/\/+$/, '');
}

function joinUrl(...parts) {
  const [first, ...rest] = parts;
  if (!first) return '';
  const encoded = rest.flatMap((part) => String(part).split('/').map((segment) => encodeURIComponent(segment)));
  return [trimSlash(first), ...encoded].join('/');
}

function issuesUrl(providerId, repositoryUrl) {
  if (!repositoryUrl) return '';
  switch (providerId) {
    case 'github': return `${repositoryUrl}/issues/new/choose`;
    case 'gitlab': return `${repositoryUrl}/-/issues/new`;
    case 'gitea':
    case 'forgejo': return `${repositoryUrl}/issues/new`;
    case 'bitbucket': return '';
    default: return `${repositoryUrl}/issues`;
  }
}

function profileRepositoryName(config, providerId, owner) {
  const configured = config.repository?.name || owner;
  if (config.kind === 'profile') {
    if (providerId === 'github' || providerId === 'gitlab') return owner;
    if (providerId === 'gitea' || providerId === 'forgejo') return '.profile';
    return configured;
  }
  if (config.kind === 'organization') {
    if (providerId === 'github') return '.github';
    if (providerId === 'gitlab') return 'gitlab-profile';
    if (providerId === 'gitea' || providerId === 'forgejo') return '.profile';
    if (providerId === 'bitbucket') return 'profile';
    return configured;
  }
  return configured;
}

export function getProviderDefinition(providerId) {
  const provider = PROVIDER_DEFINITIONS[providerId];
  if (!provider) {
    throw new Error(`Unknown provider "${providerId}". Choose: ${PROVIDER_IDS.join(', ')}`);
  }
  return { id: providerId, ...provider };
}

export function createProviderContext(config, overrideId, overrideMode) {
  const providerId = overrideId ?? config.provider?.id ?? 'portable';
  const definition = getProviderDefinition(providerId);
  const requestedMode = overrideMode ?? config.provider?.mode ?? 'portable';
  const mode = requestedMode === 'enhanced' && definition.supportsEnhancedLayout
    ? 'enhanced'
    : 'portable';
  const configuredProviderId = config.provider?.id ?? 'portable';
  const keepConfiguredLocation = !overrideId
    || overrideId === configuredProviderId
    || providerId === 'portable';
  const baseUrl = trimSlash(
    keepConfiguredLocation
      ? (config.provider?.baseUrl || definition.defaultBaseUrl)
      : definition.defaultBaseUrl,
  );
  const owner = config.repository?.owner || config.owner?.username || '';
  const repositoryName = providerId === 'portable'
    ? (config.repository?.name || owner)
    : profileRepositoryName(config, providerId, owner);
  const repositoryUrl = keepConfiguredLocation && config.repository?.url
    ? config.repository.url
    : joinUrl(baseUrl, owner, repositoryName);
  const profileUrl = owner && baseUrl ? joinUrl(baseUrl, owner) : '';

  return {
    ...definition,
    id: providerId,
    mode,
    requestedMode,
    enhanced: mode === 'enhanced',
    portable: mode === 'portable',
    baseUrl,
    repositoryUrl,
    cloneUrl: repositoryUrl ? `${repositoryUrl}.git` : '',
    issuesUrl: issuesUrl(providerId === 'portable' ? configuredProviderId : providerId, repositoryUrl),
    profileUrl,
    repositoryName,
    defaultBranch: config.repository?.defaultBranch || 'main',
  };
}
