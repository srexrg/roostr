import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { listServers, getServerRecord, upsertServer, removeServer } from '../../src/state/store.js';
import type { ServerRecord } from '../../src/core/types.js';

const root = join(tmpdir(), 'roostr-store-test');

function rec(name: string): ServerRecord {
  return {
    name, provider: 'digitalocean', providerServerId: '123', region: 'nyc1', size: 's-2vcpu-4gb',
    sshMode: 'tailscale', tailscaleName: null, publicIp: null, agents: ['claude-code'],
    createdAt: '2026-06-29T00:00:00Z', lastSetupAt: null, status: 'active',
    snapshotId: null, hibernatedAt: null,
  };
}

beforeEach(() => { process.env.XDG_CONFIG_HOME = root; });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

describe('state store', () => {
  it('starts empty', async () => {
    expect(await listServers()).toEqual([]);
  });
  it('upserts and reads back by name', async () => {
    await upsertServer(rec('box-1'));
    expect((await getServerRecord('box-1'))?.providerServerId).toBe('123');
  });
  it('upsert replaces an existing record of the same name', async () => {
    await upsertServer(rec('box-1'));
    const updated = { ...rec('box-1'), status: 'incomplete' as const };
    await upsertServer(updated);
    expect(await listServers()).toHaveLength(1);
    expect((await getServerRecord('box-1'))?.status).toBe('incomplete');
  });
  it('removes a record', async () => {
    await upsertServer(rec('box-1'));
    await removeServer('box-1');
    expect(await getServerRecord('box-1')).toBeNull();
  });
});
