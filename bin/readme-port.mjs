#!/usr/bin/env node

import { run } from '../src/node/cli.mjs';

run(process.argv.slice(2)).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`readme-port: ${message}`);
  if (process.env.README_PORT_DEBUG === '1' && error instanceof Error) {
    console.error(error.stack);
  }
  process.exitCode = error.exitCode ?? 1;
});
