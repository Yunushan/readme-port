import assert from 'node:assert/strict';
import test from 'node:test';

import { createProviderContext, getProviderDefinition } from '../src/core/providers.mjs';

const baseConfig = {
  provider: { id: 'github', mode: 'enhanced' },
  repository: { owner: 'demo', name: 'project', defaultBranch: 'main' },
};

test('derives GitHub repository and issue URLs', () => {
  const provider = createProviderContext(baseConfig);
  assert.equal(provider.repositoryUrl, 'https://github.com/demo/project');
  assert.equal(provider.cloneUrl, 'https://github.com/demo/project.git');
  assert.equal(provider.issuesUrl, 'https://github.com/demo/project/issues/new/choose');
  assert.equal(provider.mode, 'enhanced');
});

test('uses a configured self-hosted Forgejo base URL and portable fallback', () => {
  const provider = createProviderContext({
    ...baseConfig,
    provider: { id: 'forgejo', mode: 'enhanced', baseUrl: 'https://git.example.org/' },
  });
  assert.equal(provider.repositoryUrl, 'https://git.example.org/demo/project');
  assert.equal(provider.mode, 'portable');
  assert.match(provider.profilePath, /repository named \.profile/);
});

test('describes Bitbucket profile support honestly', () => {
  const provider = getProviderDefinition('bitbucket');
  assert.equal(provider.supportsNativeProfile, false);
  assert.equal(provider.profileSupport, 'repository-only');
});

test('uses the target default host when generating another provider', () => {
  const provider = createProviderContext(baseConfig, 'gitlab');
  assert.equal(provider.repositoryUrl, 'https://gitlab.com/demo/project');
});

test('preserves GitLab subgroup path segments', () => {
  const provider = createProviderContext({
    ...baseConfig,
    provider: { id: 'gitlab', mode: 'portable' },
    repository: { owner: 'group/subgroup', name: 'project' },
  });
  assert.equal(provider.repositoryUrl, 'https://gitlab.com/group/subgroup/project');
});

test('maps native profile repository names per provider', () => {
  const config = {
    kind: 'profile',
    provider: { id: 'github', mode: 'portable' },
    owner: { username: 'demo' },
    repository: { owner: 'demo', name: 'demo' },
  };
  assert.equal(createProviderContext(config, 'github').repositoryName, 'demo');
  assert.equal(createProviderContext(config, 'gitea').repositoryName, '.profile');
  assert.equal(createProviderContext(config, 'forgejo').repositoryName, '.profile');
});

test('does not create a soon-to-be-removed Bitbucket Issues link', () => {
  const provider = createProviderContext(baseConfig, 'bitbucket');
  assert.equal(provider.issuesUrl, '');
});
