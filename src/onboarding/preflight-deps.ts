import { spawnSync } from 'node:child_process';
import { confirm } from '@inquirer/prompts';
import type { Remedy } from './remedy.js';
import type { PreflightDeps } from './preflight.js';
import type { Platform } from './remedy.js';

function getPlatform(): Platform {
  if (process.platform === 'darwin') return 'darwin';
  if (process.platform === 'linux') return 'linux';
  return 'other';
}

function isBrewPresent(): boolean {
  return spawnSync('which', ['brew']).status === 0;
}

function run(command: string): { status: number } {
  const result = spawnSync(command, { shell: true, stdio: 'inherit' });
  return { status: result.status ?? 1 };
}

async function confirmRun(_remedy: Remedy): Promise<boolean> {
  return confirm({ message: 'Run this now?', default: false });
}

export function buildPreflightDeps(
  sshKeyPath: string,
  recheck: (name: string) => boolean,
): PreflightDeps {
  return {
    platform: getPlatform(),
    brewPresent: isBrewPresent(),
    sshKeyPath,
    confirmRun,
    run,
    recheck,
    log: console.log,
  };
}
