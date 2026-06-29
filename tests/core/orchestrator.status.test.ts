import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { destroyServer, status } from '../../src/core/orchestrator.js';
import { upsertServer, getServerRecord } from '../../src/state/store.js';
import type { Provider } from '../../src/providers/provider.js';
import type { ServerRecord } from '../../src/core/types.js';

const root = join(tmpdir(), 'roostr-orch-status-test');
beforeEach(() => { process.env.XDG_CONFIG_HOME = root; });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

function rec(name: string): ServerRecord {
  return {
    name, provider: 'digitalocean', providerServerId: 'srv-1', region: 'nyc1', size: 's-2vcpu-4gb',
    sshMode: 'direct', tailscaleName: null, publicIp: '203.0.113.7', agents: ['claude-code'],
    createdAt: '2026-06-29T00:00:00Z', lastSetupAt: '2026-06-29T00:05:00Z', status: 'active',
    snapshotId: null, hibernatedAt: null,
  };
}
function fakeProvider(over: Partial<Provider> = {}): Provider {
  return {
    ensureSshKey: async () => 'k', createServer: async () => ({ id: 'srv-1', state: 'running', publicIp: null }),
    getServer: async () => ({ id: 'srv-1', state: 'running', publicIp: '203.0.113.7' }),
    listServers: async () => [], destroyServer: async () => {}, ensureFirewall: async () => 'fw',
    destroyFirewall: async () => {},
    ...over,
  };
}

describe('orchestrator.destroyServer', () => {
  it('destroys via provider and removes the record', async () => {
    await upsertServer(rec('box-1'));
    let destroyedId = '';
    await destroyServer('box-1', { provider: fakeProvider({ destroyServer: async (id) => { destroyedId = id; } }) });
    expect(destroyedId).toBe('srv-1');
    expect(await getServerRecord('box-1')).toBeNull();
  });

  it('deletes the firewall before the droplet, then prunes state', async () => {
    await upsertServer({ ...rec('box-1'), firewallId: 'fw-1' });
    const order: string[] = [];
    await destroyServer('box-1', { provider: fakeProvider({
      destroyFirewall: async (id) => { order.push(`fw:${id}`); },
      destroyServer: async (id) => { order.push(`srv:${id}`); },
    }) });
    expect(order).toEqual(['fw:fw-1', 'srv:srv-1']);
    expect(await getServerRecord('box-1')).toBeNull();
  });
});

describe('orchestrator.status', () => {
  it('reconciles live state and attaches a cost estimate', async () => {
    await upsertServer(rec('box-1'));
    const views = await status({ provider: fakeProvider() }, 'box-1');
    expect(views[0].liveState).toBe('running');
    expect(views[0].monthlyCostUsd).toBe(24);
  });
  it('marks a vanished server as gone (drift)', async () => {
    await upsertServer(rec('box-1'));
    const views = await status({ provider: fakeProvider({ getServer: async () => null }) }, 'box-1');
    expect(views[0].liveState).toBe('gone');
  });
});
