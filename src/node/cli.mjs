import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createStarterConfig } from '../core/config.mjs';
import { PROVIDER_IDS } from '../core/providers.mjs';
import { TEMPLATE_REGISTRY, THEME_REGISTRY } from '../core/registry.mjs';
import { validateConfig } from '../core/validate.mjs';
import {
  buildAllProviders,
  buildToPath,
  diagnoseBuild,
  ejectTemplate,
  pathExists,
  readJson,
  writeAtomic,
} from './io.mjs';
import { startServer } from './server.mjs';

const VERSION = '1.0.0';

const HELP = `
ReadmePort ${VERSION} — One config. Beautiful READMEs for every forge.

Usage:
  readme-port init [--kind project|profile|organization] [--config FILE]
  readme-port build [--config FILE] [--output FILE] [--provider ID] [--mode MODE]
  readme-port build --provider all [--output DIRECTORY]
  readme-port check [--config FILE] [--output FILE]
  readme-port validate [--config FILE]
  readme-port doctor [--config FILE] [--output FILE]
  readme-port eject [--config FILE] [--output TEMPLATE]
  readme-port list [templates|providers|themes]
  readme-port serve [--host HOST] [--port PORT]

Common options:
  -c, --config FILE       Configuration file (default: readme-port.config.json)
  -o, --output PATH       README output, template path, or output directory
  -p, --provider ID       portable, github, gitlab, gitea, forgejo, bitbucket, or all
      --mode MODE         portable or enhanced
  -t, --template ID       Override the configured template
  -f, --force             Allow replacing an unrecognized output
      --stdout            Print generated Markdown instead of writing it
      --no-strict         Leave missing template values empty
  -h, --help              Show this help
  -v, --version           Show the version
`;

const COMMAND_OPTIONS = {
  init: new Set(['kind', 'config', 'force']),
  build: new Set(['config', 'output', 'provider', 'mode', 'template', 'force', 'stdout', 'strict']),
  check: new Set(['config', 'output', 'provider', 'mode', 'template', 'strict']),
  validate: new Set(['config', 'provider', 'mode', 'template']),
  doctor: new Set(['config', 'output', 'provider', 'mode', 'template']),
  eject: new Set(['config', 'output', 'force']),
  list: new Set([]),
  serve: new Set(['host', 'port']),
};

function parseArguments(argv) {
  const args = [...argv];
  const command = args[0] && !args[0].startsWith('-') ? args.shift() : 'help';
  const options = { _: [] };
  const aliases = { c: 'config', o: 'output', p: 'provider', t: 'template', f: 'force', h: 'help', v: 'version' };

  while (args.length > 0) {
    const token = args.shift();
    if (!token.startsWith('-')) {
      options._.push(token);
      continue;
    }
    const raw = token.replace(/^-+/, '');
    const [rawKey, inlineValue] = raw.split(/=(.*)/s, 2);
    const key = aliases[rawKey] || rawKey;
    if (key.startsWith('no-')) {
      options[key.slice(3)] = false;
      continue;
    }
    if (['force', 'help', 'version', 'stdout'].includes(key)) {
      options[key] = true;
      continue;
    }
    const value = inlineValue ?? args.shift();
    if (value === undefined || value.startsWith('-')) {
      throw new Error(`Option --${key} requires a value`);
    }
    options[key] = value;
  }
  return { command, options };
}

function common(options) {
  return {
    configPath: options.config || 'readme-port.config.json',
    outputPath: options.output || 'README.md',
    overrides: {
      ...(options.provider && options.provider !== 'all' ? { provider: options.provider } : {}),
      ...(options.mode ? { mode: options.mode } : {}),
      ...(options.template ? { template: options.template } : {}),
    },
    force: Boolean(options.force),
    strict: options.strict !== false,
  };
}

function assertCommandOptions(command, options) {
  const allowed = COMMAND_OPTIONS[command];
  if (!allowed) return;
  const unknown = Object.keys(options)
    .filter((key) => key !== '_' && !allowed.has(key));
  if (unknown.length > 0) {
    throw new Error(`Unknown option for ${command}: ${unknown.map((key) => `--${key}`).join(', ')}`);
  }
  const maximumPositionals = command === 'list' ? 1 : 0;
  if (options._.length > maximumPositionals) {
    throw new Error(`Unexpected argument${options._.length > 1 ? 's' : ''}: ${options._.join(' ')}`);
  }
}

function printWarnings(warnings = []) {
  warnings.forEach((warning) => console.warn(`warning: ${warning}`));
}

async function init(options) {
  const kind = options.kind || 'project';
  if (!['project', 'profile', 'organization'].includes(kind)) {
    throw new Error('--kind must be project, profile, or organization');
  }
  const configPath = path.resolve(options.config || 'readme-port.config.json');
  if (await pathExists(configPath) && !options.force) {
    throw new Error(`${configPath} already exists; use --force to replace it`);
  }
  const config = createStarterConfig(kind);
  await writeAtomic(configPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`Created ${configPath}`);
}

async function build(options) {
  const values = common(options);
  if (options.provider === 'all') {
    if (options.stdout) {
      throw new Error('--stdout cannot be combined with --provider all; choose one provider');
    }
    const outputDirectory = options.output || 'dist';
    const results = await buildAllProviders({
      configPath: values.configPath,
      outputDirectory,
      overrides: values.overrides,
      force: values.force,
      strict: values.strict,
    });
    results.forEach((result) => {
      console.log(`Built ${result.context.provider.id.padEnd(9)} ${result.outputPath}`);
      printWarnings(result.warnings);
    });
    console.warn('warning: multi-provider files are staging outputs; copy the chosen README to each target repository root so relative links and assets resolve');
    return;
  }
  const result = await buildToPath({
    ...values,
    force: values.force || Boolean(options.stdout),
    write: !options.stdout,
  });
  printWarnings(result.warnings);
  if (options.stdout) {
    process.stdout.write(result.content);
  } else {
    console.log(`Built ${result.outputPath} for ${result.context.provider.name} (${result.context.provider.mode})`);
    if (result.context.kind === 'profile') console.log(`Placement: ${result.context.provider.profilePath}`);
    if (result.context.kind === 'organization') console.log(`Placement: ${result.context.provider.organizationProfilePath}`);
  }
}

async function check(options) {
  const values = common(options);
  if (!await pathExists(values.outputPath)) {
    const error = new Error(`Output does not exist: ${path.resolve(values.outputPath)}`);
    error.exitCode = 4;
    throw error;
  }
  const existing = await readFile(values.outputPath, 'utf8');
  const result = await buildToPath({ ...values, force: true, write: false });
  if (existing.replace(/\r\n?/g, '\n') !== result.content) {
    const error = new Error(`${path.resolve(values.outputPath)} is stale; run readme-port build`);
    error.exitCode = 4;
    throw error;
  }
  console.log(`${path.resolve(values.outputPath)} is up to date`);
}

async function validate(options) {
  const configPath = path.resolve(options.config || 'readme-port.config.json');
  const config = await readJson(configPath);
  const report = validateConfig(config, {
    ...(options.provider ? { provider: options.provider } : {}),
    ...(options.mode ? { mode: options.mode } : {}),
    ...(options.template ? { template: options.template } : {}),
  });
  printWarnings(report.warnings);
  if (report.errors.length > 0) {
    const error = new Error(`Invalid configuration:\n- ${report.errors.join('\n- ')}`);
    error.exitCode = 2;
    throw error;
  }
  console.log(`${configPath} is valid`);
}

async function doctor(options) {
  const values = common(options);
  const result = await diagnoseBuild(values);
  printWarnings([...result.warnings, ...result.report.warnings]);
  if (result.report.errors.length > 0) {
    const error = new Error(`README compatibility check failed:\n- ${result.report.errors.join('\n- ')}`);
    error.exitCode = 5;
    throw error;
  }
  console.log(`No blocking compatibility problems for ${result.context.provider.name}`);
}

async function eject(options) {
  const result = await ejectTemplate({
    configPath: options.config || 'readme-port.config.json',
    destination: options.output,
    force: Boolean(options.force),
  });
  console.log(`Ejected template to ${result.destination}`);
  console.log(`Updated ${result.configPath} to use the editable template`);
}

function list(options) {
  const target = options._[0] || 'templates';
  if (target === 'templates') {
    TEMPLATE_REGISTRY.forEach((item) => console.log(`${item.id.padEnd(25)} ${item.description}`));
    return;
  }
  if (target === 'providers') {
    PROVIDER_IDS.forEach((item) => console.log(item));
    return;
  }
  if (target === 'themes') {
    THEME_REGISTRY.forEach((item) => console.log(`${item.id.padEnd(12)} ${item.name}`));
    return;
  }
  throw new Error('list expects templates, providers, or themes');
}

async function serve(options) {
  const port = Number.parseInt(options.port || '4173', 10);
  const host = options.host || '127.0.0.1';
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('--port must be an integer between 1 and 65535');
  }
  const server = await startServer({ port, host });
  console.log(`ReadmePort Studio: http://${host}:${port}/web/`);
  console.log('Press Ctrl+C to stop.');
  await new Promise((resolve) => {
    const shutdown = () => server.close(resolve);
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}

export async function run(argv) {
  const { command, options } = parseArguments(argv);
  if (options.version || command === 'version') {
    console.log(VERSION);
    return;
  }
  if (options.help || command === 'help') {
    console.log(HELP.trim());
    return;
  }

  const commands = { init, build, check, validate, doctor, eject, list, serve };
  const handler = commands[command];
  if (!handler) {
    throw new Error(`Unknown command "${command}". Run readme-port --help.`);
  }
  assertCommandOptions(command, options);
  await handler(options);
}
