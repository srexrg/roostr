import { describe, it, expect } from 'bun:test';
import { resolveSshTarget } from '../../src/commands/ssh.js';
import { ConfigError } from '../../src/core/errors.js';
import type { ServerRecord } from '../../src/core/types.js';

function rec(over: Partial<ServerRecord>): ServerRecord {
  return {
    name: 'box-1', provider: 'digitalocean', providerServerId: 's', region: 'nyc1', size: 's-1vcpu-1gb',
    sshMode: 'direct', tailscaleName: null, publicIp: '203.0.113.7', agents: ['claude-code'],
    createdAt: 'x', lastSetupAt: null, status: 'active', snapshotId: null, hibernatedAt: null, ...over,
  };
}

describe('resolveSshTarget', () => {
  it('direct mode targets the public IP', () => {
    expect(resolveSshTarget(rec({}))).toEqual({ user: 'dev', host: '203.0.113.7' });
  });
  it('tailscale mode targets the tailscale hostname', () => {
    expect(resolveSshTarget(rec({ sshMode: 'tailscale', tailscaleName: 'box-1', publicIp: null })))
      .toEqual({ user: 'dev', host: 'box-1' });
  });
  it('throws when the needed host is missing', () => {
    expect(() => resolveSshTarget(rec({ sshMode: 'tailscale', tailscaleName: null }))).toThrow(ConfigError);
  });
});
