import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PROVIDER_IDS } from '../src/core/providers.mjs';
import { buildToPath } from '../src/node/io.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const generated = path.join(root, 'examples', 'generated');
const jobs = [
  { label: 'project', config: path.join(root, 'examples', 'project.config.json') },
  { label: 'profile', config: path.join(root, 'examples', 'profile.config.json') },
  { label: 'organization', config: path.join(root, 'examples', 'organization.config.json') },
];

for (const job of jobs) {
  for (const provider of PROVIDER_IDS) {
    const outputPath = path.join(generated, `${job.label}-${provider}.md`);
    const result = await buildToPath({
      configPath: job.config,
      outputPath,
      overrides: { provider },
      force: true,
      strict: true,
    });
    console.log(`${job.label.padEnd(8)} ${provider.padEnd(9)} ${path.relative(root, result.outputPath)}`);
  }
}
