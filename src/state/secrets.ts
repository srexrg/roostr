import { configPath } from '../util/paths.js';
import { readJson, writeJsonAtomic } from '../util/atomic.js';

const FILE = 'secrets.json';

const ENV_MAP: Record<string, string> = {
  digitalocean: 'DIGITALOCEAN_TOKEN',
  hetzner: 'HETZNER_TOKEN',
  tailscale: 'TS_AUTHKEY',
};

export function secretEnvVar(key: string): string {
  return ENV_MAP[key] ?? `ROOSTR_${key.toUpperCase()}`;
}

async function readFileSecrets(): Promise<Record<string, string>> {
  return (await readJson<Record<string, string>>(configPath(FILE))) ?? {};
}

// Resolution order: env var -> secrets.json. (Keychain adapter slots in here later.)
export async function getSecret(key: string): Promise<string | null> {
  const fromEnv = process.env[secretEnvVar(key)];
  if (fromEnv) return fromEnv;
  const file = await readFileSecrets();
  return file[key] ?? null;
}

export async function setSecret(key: string, value: string): Promise<void> {
  const file = await readFileSecrets();
  file[key] = value;
  await writeJsonAtomic(configPath(FILE), file, { mode: 0o600 });
}
