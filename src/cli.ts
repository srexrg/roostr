#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { Command } from 'commander';
import { APP_NAME, VERSION } from './version.js';
import { RoostrError } from './core/errors.js';
import { runInit } from './commands/init.js';

export function buildProgram(): Command {
  const program = new Command();
  program.name(APP_NAME).description('Provision a hardened, agent-ready VPS in one command.').version(VERSION);
  program.command('init').description('Configure provider, credentials, and defaults').action(runInit);

  program.command('up')
    .description('Provision a hardened agent-ready VPS')
    .requiredOption('--name <name>', 'server name')
    .option('--provider <provider>', 'digitalocean | hetzner')
    .option('--region <region>')
    .option('--size <size>')
    .action((opts) => import('./commands/up.js').then((m) => m.runUp(opts)));

  program.command('status')
    .description('Show tracked servers, reconciled against the provider')
    .argument('[name]', 'optional server name')
    .action((name) => import('./commands/status.js').then((m) => m.runStatus(name)));

  program.command('destroy')
    .description('Destroy a server and remove it from local state')
    .argument('<name>', 'server name')
    .option('--yes', 'skip confirmation')
    .action((name, opts) => import('./commands/destroy.js').then((m) => m.runDestroy(name, opts)));

  return program;
}

async function main(): Promise<void> {
  try {
    await buildProgram().parseAsync(process.argv);
  } catch (err) {
    if (err instanceof RoostrError) {
      console.error(`[${err.phase}] ${err.message}${err.hint ? `\n  hint: ${err.hint}` : ''}`);
    } else {
      console.error(err instanceof Error ? err.message : String(err));
    }
    process.exitCode = 1;
  }
}

// Only run when this file is the entry point, not when imported by tests.
// realpath both sides so a globally-linked/installed bin (where argv[1] is a
// symlink to this file, e.g. `npm install -g` or `bun link`) still matches.
// Works under Node (dist/cli.js) and Bun (src/cli.ts).
function isEntrypoint(): boolean {
  const arg = process.argv[1];
  if (!arg) return false;
  try {
    return realpathSync(arg) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}
if (isEntrypoint()) {
  void main();
}
