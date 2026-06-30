import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../state/config.js';
import { getSecret } from '../state/secrets.js';
import { runPreflight } from '../onboarding/preflight.js';
import { buildPreflightDeps } from '../onboarding/preflight-deps.js';

export interface DoctorCheck { name: string; status: 'ok' | 'warn' | 'error'; detail: string }
export interface DoctorDeps { has: (cmd: string) => boolean; fileExists: (path: string) => boolean; hasToken: boolean; sshPublicKeyPath: string }

export function runDoctorChecks(deps: DoctorDeps): DoctorCheck[] {
  const tool = (cmd: string, why: string): DoctorCheck =>
    deps.has(cmd) ? { name: cmd, status: 'ok', detail: 'found' } : { name: cmd, status: 'warn', detail: why };
  return [
    tool('gh', 'needed for roostr up --clone'),
    tool('tailscale', 'needed for tailscale mode and to connect'),
    tool('rsync', 'needed for roostr up --copy'),
    deps.fileExists(deps.sshPublicKeyPath)
      ? { name: 'ssh key', status: 'ok', detail: deps.sshPublicKeyPath }
      : { name: 'ssh key', status: 'error', detail: 'generate one: ssh-keygen -t ed25519' },
    deps.hasToken
      ? { name: 'provider token', status: 'ok', detail: 'configured' }
      : { name: 'provider token', status: 'error', detail: 'run roostr init' },
  ];
}

function printChecks(checks: DoctorCheck[]): void {
  const marker = { ok: '[OK]', warn: '[WARN]', error: '[ERR]' } as const;
  for (const c of checks) {
    console.log(`${marker[c.status]} ${c.name} - ${c.detail}`);
  }
}

async function buildDoctorDeps(): Promise<{ deps: DoctorDeps; sshPublicKeyPath: string }> {
  const config = await loadConfig();
  const sshPublicKeyPath = config?.sshPublicKeyPath ?? join(homedir(), '.ssh', 'id_ed25519.pub');
  let hasToken = false;
  if (config) {
    hasToken = !!(await getSecret(config.defaultProvider));
  }
  const deps: DoctorDeps = {
    has: (cmd) => spawnSync('which', [cmd]).status === 0,
    fileExists: (path) => existsSync(path),
    hasToken,
    sshPublicKeyPath,
  };
  return { deps, sshPublicKeyPath };
}

export async function runDoctor(opts?: { fix?: boolean }): Promise<void> {
  const { deps, sshPublicKeyPath } = await buildDoctorDeps();
  const checks = runDoctorChecks(deps);
  printChecks(checks);

  if (opts?.fix) {
    const preflightDeps = buildPreflightDeps(sshPublicKeyPath, (name) => {
      const freshDeps: DoctorDeps = {
        has: (cmd) => spawnSync('which', [cmd]).status === 0,
        fileExists: (path) => existsSync(path),
        hasToken: deps.hasToken,
        sshPublicKeyPath,
      };
      const freshChecks = runDoctorChecks(freshDeps);
      const found = freshChecks.find((c) => c.name === name);
      return found?.status === 'ok';
    });

    await runPreflight(checks, preflightDeps, []);

    console.log('');
    const { deps: updatedDeps } = await buildDoctorDeps();
    const updatedChecks = runDoctorChecks(updatedDeps);
    printChecks(updatedChecks);
    if (updatedChecks.some((c) => c.status === 'error')) process.exitCode = 1;
    return;
  }

  if (checks.some((c) => c.status === 'error')) process.exitCode = 1;
}
