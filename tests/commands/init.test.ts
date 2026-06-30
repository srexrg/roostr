import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { buildConfigFromAnswers, persistInit, type InitAnswers } from '../../src/commands/init.js';
import { loadConfig } from '../../src/state/config.js';
import { getSecret } from '../../src/state/secrets.js';

const root = join(tmpdir(), 'roostr-init-test');
const answers: InitAnswers = {
  provider: 'digitalocean', token: 'tok-123', region: 'nyc1', size: 's-2vcpu-4gb',
  sshMode: 'tailscale', tailscaleAuthKey: 'tskey-abc', agents: ['claude-code', 'codex'],
  sshPublicKeyPath: '/home/u/.ssh/id_ed25519.pub',
};

beforeEach(() => {
  process.env.XDG_CONFIG_HOME = root;
  delete process.env.DIGITALOCEAN_TOKEN;
  delete process.env.TS_AUTHKEY;
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

describe('init', () => {
  it('maps answers to a Config without leaking the token', () => {
    const cfg = buildConfigFromAnswers(answers);
    expect(cfg.defaultProvider).toBe('digitalocean');
    expect(cfg.providers.digitalocean).toEqual({ region: 'nyc1', size: 's-2vcpu-4gb' });
    expect(cfg.defaultAgents).toEqual(['claude-code', 'codex']);
    expect(JSON.stringify(cfg)).not.toContain('tok-123');
  });
  it('persists config and secrets separately', async () => {
    await persistInit(answers);
    const cfg = await loadConfig();
    expect(cfg?.defaultProvider).toBe('digitalocean');
    expect(await getSecret('digitalocean')).toBe('tok-123');
    expect(await getSecret('tailscale')).toBe('tskey-abc');
  });
  it('does not write a claude secret (token path removed)', async () => {
    await persistInit(answers);
    const { getSecret } = await import('../../src/state/secrets.js');
    expect(await getSecret('claude-code')).toBeNull();
  });
});
