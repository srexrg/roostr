import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

export function sshConfigPath(): string {
  return join(homedir(), '.ssh', 'config');
}

function markers(name: string) {
  return { start: `# >>> roostr ${name} >>>`, end: `# <<< roostr ${name} <<<` };
}

function stripBlock(text: string, name: string): string {
  const { start, end } = markers(name);
  const re = new RegExp(`\\n?${start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`, 'g');
  return text.replace(re, '\n');
}

export async function upsertSshConfigBlock(opts: { name: string; host: string; user: string; path?: string }): Promise<void> {
  const path = opts.path ?? sshConfigPath();
  await mkdir(dirname(path), { recursive: true });
  let existing = '';
  try { existing = await readFile(path, 'utf8'); } catch { /* no file yet */ }
  const cleaned = stripBlock(existing, opts.name).replace(/\n+$/, '');
  const { start, end } = markers(opts.name);
  const block = `${start}\nHost ${opts.name}\n  HostName ${opts.host}\n  User ${opts.user}\n${end}`;
  const next = (cleaned ? `${cleaned}\n\n` : '') + block + '\n';
  await writeFile(path, next, { mode: 0o600 });
}

export async function removeSshConfigBlock(name: string, path = sshConfigPath()): Promise<void> {
  let existing = '';
  try { existing = await readFile(path, 'utf8'); } catch { return; }
  await writeFile(path, stripBlock(existing, name).replace(/\n+$/, '') + '\n', { mode: 0o600 });
}
