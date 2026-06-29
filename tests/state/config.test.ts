import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { loadConfig, saveConfig, requireConfig } from '../../src/state/config.js';
import { ConfigError } from '../../src/core/errors.js';
import type { Config } from '../../src/core/types.js';

const root = join(tmpdir(), 'roostr-config-test');
const sample: Config = {
  defaultProvider: 'digitalocean',
  providers: { digitalocean: { region: 'nyc1', size: 's-2vcpu-4gb' } },
  defaultAgents: ['claude-code'],
  sshMode: 'tailscale',
  sshPublicKeyPath: '/home/u/.ssh/id_ed25519.pub',
};

beforeEach(() => { process.env.XDG_CONFIG_HOME = root; });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

describe('config store', () => {
  it('returns null when unconfigured', async () => {
    expect(await loadConfig()).toBeNull();
  });
  it('round-trips a saved config', async () => {
    await saveConfig(sample);
    expect(await loadConfig()).toEqual(sample);
  });
  it('requireConfig throws ConfigError when absent', async () => {
    await expect(requireConfig()).rejects.toBeInstanceOf(ConfigError);
  });
});
