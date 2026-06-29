import { spawn } from 'node:child_process';
import type { ServerRecord } from '../core/types.js';
import { ConfigError } from '../core/errors.js';
import { listServers, getServerRecord } from '../state/store.js';

export function resolveSshTarget(record: ServerRecord): { host: string; user: string } {
  const user = 'dev';
  if (record.sshMode === 'tailscale') {
    if (!record.tailscaleName) throw new ConfigError(`no tailscale name for ${record.name}`, 'try roostr status');
    return { user, host: record.tailscaleName };
  }
  if (!record.publicIp) throw new ConfigError(`no public IP for ${record.name}`, 'try roostr status');
  return { user, host: record.publicIp };
}

export async function runSsh(name?: string): Promise<void> {
  let record: ServerRecord | null;
  if (name) {
    record = await getServerRecord(name);
  } else {
    const all = await listServers();
    if (all.length === 1) record = all[0];
    else if (all.length === 0) { console.error('No servers. Run: roostr up'); process.exitCode = 1; return; }
    else { console.error(`Multiple servers - name one:\n${all.map((s) => '  ' + s.name).join('\n')}`); process.exitCode = 1; return; }
  }
  if (!record) { console.error(`No server named ${name}. Run: roostr status`); process.exitCode = 1; return; }
  const { user, host } = resolveSshTarget(record);
  // -t forces a TTY; tmux new -A attaches an existing 'roostr' session or creates it.
  const child = spawn('ssh', ['-t', `${user}@${host}`, 'tmux new -A -s roostr'], { stdio: 'inherit' });
  await new Promise<void>((resolve) => child.on('close', () => resolve()));
}
