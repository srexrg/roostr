import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm, stat } from 'node:fs/promises';
import { getSecret, setSecret, secretEnvVar } from '../../src/state/secrets.js';
import { configPath } from '../../src/util/paths.js';

const root = join(tmpdir(), 'roostr-secrets-test');

beforeEach(() => {
  process.env.XDG_CONFIG_HOME = root;
  delete process.env.DIGITALOCEAN_TOKEN;
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  delete process.env.DIGITALOCEAN_TOKEN;
});

describe('secret store', () => {
  it('maps logical keys to env vars', () => {
    expect(secretEnvVar('digitalocean')).toBe('DIGITALOCEAN_TOKEN');
    expect(secretEnvVar('hetzner')).toBe('HETZNER_TOKEN');
    expect(secretEnvVar('tailscale')).toBe('TS_AUTHKEY');
  });
  it('prefers the env var over the file', async () => {
    await setSecret('digitalocean', 'from-file');
    process.env.DIGITALOCEAN_TOKEN = 'from-env';
    expect(await getSecret('digitalocean')).toBe('from-env');
  });
  it('falls back to the file when no env var', async () => {
    await setSecret('digitalocean', 'from-file');
    expect(await getSecret('digitalocean')).toBe('from-file');
  });
  it('returns null when unset everywhere', async () => {
    expect(await getSecret('digitalocean')).toBeNull();
  });
  it('writes secrets.json with 0600 perms', async () => {
    await setSecret('digitalocean', 'x');
    const s = await stat(configPath('secrets.json'));
    expect(s.mode & 0o777).toBe(0o600);
  });
});
