import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { up, type UpDeps } from '../../src/core/orchestrator.js';
import { getServerRecord } from '../../src/state/store.js';
import type { Provider, ProviderServer } from '../../src/providers/provider.js';
import type { BuildSpec } from '../../src/core/types.js';

const root = join(tmpdir(), 'roostr-orch-up-test');
beforeEach(() => { process.env.XDG_CONFIG_HOME = root; });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

const spec: BuildSpec = {
  name: 'box-1', provider: 'digitalocean', region: 'nyc1', size: 's-2vcpu-4gb',
  agents: ['claude-code'], sshMode: 'direct', sshPublicKeyPath: '/fake/key.pub',
  project: { kind: 'fresh' },
};

function fakeProvider(over: Partial<Provider> = {}): Provider {
  return {
    ensureSshKey: async () => 'key-1',
    ensureTag: async () => {},
    createServer: async () => ({ id: 'srv-1', state: 'provisioning', publicIp: null }),
    getServer: async () => ({ id: 'srv-1', state: 'running', publicIp: '203.0.113.7' }),
    listServers: async () => [],
    destroyServer: async () => {},
    ensureFirewall: async () => 'fw-1',
    destroyFirewall: async () => {},
    listSizes: async () => [],
    listRegions: async () => [],
    ...over,
  };
}

function baseDeps(provider: Provider): UpDeps {
  return {
    provider,
    readPublicKey: async () => 'ssh-ed25519 AAAA key',
    detectPublicIp: async () => '203.0.113.7',
    waitForReady: async () => ({ id: 'srv-1', state: 'running', publicIp: '203.0.113.7' }),
    now: () => '2026-06-29T00:00:00Z',
    agentRecipes: [],
    extraFragments: [],
  };
}

describe('orchestrator.up', () => {
  it('provisions and records an active server', async () => {
    let firewallInput: any = null;
    const provider = fakeProvider({ ensureFirewall: async (i) => { firewallInput = i; return 'fw-1'; } });
    const rec = await up(spec, baseDeps(provider));
    expect(rec.status).toBe('active');
    expect(rec.providerServerId).toBe('srv-1');
    expect(rec.publicIp).toBe('203.0.113.7');
    expect((await getServerRecord('box-1'))?.status).toBe('active');
    expect(firewallInput.sshSourceCidr).toBe('203.0.113.7/32');
    expect(firewallInput.tag).toBe('roostr-box-1');
  });

  it('leaves an incomplete record when readiness fails after create', async () => {
    const deps = baseDeps(fakeProvider());
    deps.waitForReady = async () => { throw new Error('timeout'); };
    await expect(up(spec, deps)).rejects.toThrow('timeout');
    const rec = await getServerRecord('box-1');
    expect(rec?.status).toBe('incomplete');
    expect(rec?.providerServerId).toBe('srv-1'); // tracked, not orphaned
  });

  it('cleans up the firewall if droplet creation fails (no orphan)', async () => {
    let destroyed = '';
    const provider = fakeProvider({
      ensureFirewall: async () => 'fw-orphan',
      createServer: async () => { throw new Error('boom'); },
      destroyFirewall: async (id) => { destroyed = id; },
    });
    await expect(up(spec, baseDeps(provider))).rejects.toThrow('boom');
    expect(destroyed).toBe('fw-orphan');
  });

  it('includes any provided extraFragments in the cloud-init', async () => {
    let userData = '';
    const provider = fakeProvider({ createServer: async (i: any) => { userData = i.userData; return { id: 'srv-1', state: 'provisioning', publicIp: null }; } });
    const deps = baseDeps(provider);
    deps.extraFragments = [{ runcmd: ['echo CLONE_MARKER'] }];
    await up(spec, deps);
    expect(userData).toContain('echo CLONE_MARKER');
  });

  it('tailscale mode: closed firewall, records firewallId + tailscaleName, probes hostname', async () => {
    let firewallInput: any = null;
    let probeHost: string | undefined;
    const provider = fakeProvider({ ensureFirewall: async (i) => { firewallInput = i; return 'fw-9'; } });
    const deps = baseDeps(provider);
    deps.tailscaleAuthKey = 'tskey-1';
    deps.waitForReady = async (_id, _s, ph) => { probeHost = ph; return { id: 'srv-1', state: 'running', publicIp: '203.0.113.7' }; };
    const tsSpec = { ...spec, sshMode: 'tailscale' as const };
    const rec = await up(tsSpec, deps);
    expect(firewallInput.sshSourceCidr).toBeNull();   // zero inbound
    expect(rec.firewallId).toBe('fw-9');
    expect(rec.tailscaleName).toBe('box-1');
    expect(probeHost).toBe('box-1');
  });
});
