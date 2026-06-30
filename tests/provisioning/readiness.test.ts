import { describe, it, expect } from 'bun:test';
import { waitForReady } from '../../src/provisioning/readiness.js';
import { ConnectivityError } from '../../src/core/errors.js';
import type { ProviderServer } from '../../src/providers/provider.js';

function clock() {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => { t += ms; } };
}

describe('waitForReady', () => {
  it('resolves once the server is running with IP and port 22 is open', async () => {
    const states: ProviderServer[] = [
      { id: '1', state: 'provisioning', publicIp: null },
      { id: '1', state: 'running', publicIp: '203.0.113.7' },
    ];
    const c = clock();
    const server = await waitForReady('1', {
      getServer: async () => states.shift() ?? { id: '1', state: 'running', publicIp: '203.0.113.7' },
      probeTcp: async () => true,
      sleep: c.sleep, now: c.now,
    }, { intervalMs: 1000, timeoutMs: 60000 });
    expect(server.publicIp).toBe('203.0.113.7');
  });

  it('throws ConnectivityError mentioning TCP when the box boots but port 22 stays closed', async () => {
    const c = clock();
    await expect(waitForReady('1', {
      getServer: async () => ({ id: '1', state: 'running', publicIp: '203.0.113.7' }),
      probeTcp: async () => false,
      sleep: c.sleep, now: c.now,
    }, { intervalMs: 1000, timeoutMs: 5000 })).rejects.toThrow(/TCP|port 22|SSH/i);
  });

  it('throws ConnectivityError mentioning boot when the server never reaches running', async () => {
    const c = clock();
    await expect(waitForReady('1', {
      getServer: async () => ({ id: '1', state: 'provisioning', publicIp: null }),
      probeTcp: async () => true,
      sleep: c.sleep, now: c.now,
    }, { intervalMs: 1000, timeoutMs: 5000 })).rejects.toThrow(/boot|running|never became/i);
  });

  it('reports progress stages via onProgress', async () => {
    const c = clock();
    const stages: string[] = [];
    const states = [
      { id: '1', state: 'provisioning' as const, publicIp: null },
      { id: '1', state: 'running' as const, publicIp: '203.0.113.7' },
    ];
    let probeOk = false;
    await waitForReady('1', {
      getServer: async () => states.shift() ?? { id: '1', state: 'running' as const, publicIp: '203.0.113.7' },
      probeTcp: async () => { const r = probeOk; probeOk = true; return r; }, // closed once, then open
      sleep: c.sleep, now: c.now,
    }, { intervalMs: 1000, timeoutMs: 60000, onProgress: (s) => stages.push(s) });
    expect(stages).toContain('provisioning');
    expect(stages).toContain('booting');
    expect(stages[stages.length - 1]).toBe('ready');
  });

  it('probes opts.probeHost when provided (Tailscale mode)', async () => {
    const c = clock();
    let probed = '';
    const server = await waitForReady('1', {
      getServer: async () => ({ id: '1', state: 'running', publicIp: '203.0.113.7' }),
      probeTcp: async (host) => { probed = host; return true; },
      sleep: c.sleep, now: c.now,
    }, { intervalMs: 1000, timeoutMs: 60000, probeHost: 'box-1' });
    expect(probed).toBe('box-1');
    expect(server.id).toBe('1');
  });
});
