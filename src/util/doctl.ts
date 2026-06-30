import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';

export function doctlConfigPath(): string {
  if (platform() === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'doctl', 'config.yaml');
  }
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, 'doctl', 'config.yaml');
}

export async function readDoctlTokenFrom(path: string): Promise<string | null> {
  try {
    const data = parse(await readFile(path, 'utf8')) as any;
    if (typeof data?.['access-token'] === 'string') return data['access-token'];
    const ctx = data?.context;
    const fromCtx = ctx && data?.['auth-contexts']?.[ctx]?.['access-token'];
    return typeof fromCtx === 'string' ? fromCtx : null;
  } catch {
    return null;
  }
}

export function readDoctlToken(): Promise<string | null> {
  return readDoctlTokenFrom(doctlConfigPath());
}
