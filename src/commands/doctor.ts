import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../state/config.js';
import { getSecret } from '../state/secrets.js';

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

export async function runDoctor(): Promise<void> {
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
  const checks = runDoctorChecks(deps);
  const marker = { ok: '[OK]', warn: '[WARN]', error: '[ERR]' } as const;
  for (const c of checks) {
    console.log(`${marker[c.status]} ${c.name} - ${c.detail}`);
  }
  if (checks.some((c) => c.status === 'error')) process.exitCode = 1;
}
