import { describe, it, expect } from 'bun:test';
import { DigitalOceanProvider } from '../../src/providers/digitalocean.js';

function fakeFetch(responses: Array<{ status: number; body?: unknown }>) {
  const calls: Array<{ url: string; method: string; body: any }> = [];
  const impl = (async (url: string, init: any = {}) => {
    calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined });
    const next = responses.shift()!;
    return new Response(next.body === undefined ? '' : JSON.stringify(next.body), { status: next.status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('DigitalOceanProvider.ensureFirewall', () => {
  it('creates a deny-all-but-ssh firewall scoped to the source IP and returns its id', async () => {
    const { impl, calls } = fakeFetch([{ status: 202, body: { firewall: { id: 'fw-abc', status: 'waiting' } } }]);
    const p = new DigitalOceanProvider('tok', impl);
    const id = await p.ensureFirewall({ name: 'box-1-fw', serverId: '3164444', sshSourceCidr: '203.0.113.7/32' });
    expect(id).toBe('fw-abc');
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('https://api.digitalocean.com/v2/firewalls');
    const body = calls[0].body;
    expect(body.name).toBe('box-1-fw');
    expect(body.droplet_ids).toEqual([3164444]);
    expect(body.inbound_rules).toEqual([
      { protocol: 'tcp', ports: '22', sources: { addresses: ['203.0.113.7/32'] } },
    ]);
    // outbound must be present (else the droplet has no egress)
    expect(body.outbound_rules.length).toBeGreaterThanOrEqual(2);
    expect(body.outbound_rules.some((r: any) => r.protocol === 'tcp' && r.ports === 'all')).toBe(true);
  });
});
