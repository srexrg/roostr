import { describe, it, expect } from 'bun:test';
import { DigitalOceanProvider } from '../../src/providers/digitalocean.js';

function fakeFetch(responses: Array<{ status: number; body?: unknown }>) {
  const calls: Array<{ url: string; method: string; body: any }> = [];
  const impl = (async (url: string, init: any = {}) => {
    calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined });
    const n = responses.shift()!;
    return new Response(n.body === undefined ? '' : JSON.stringify(n.body), { status: n.status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('DigitalOcean firewall - Tailscale (closed) mode', () => {
  it('creates a firewall with NO inbound rules when sshSourceCidr is null', async () => {
    const { impl, calls } = fakeFetch([{ status: 202, body: { firewall: { id: 'fw-1' } } }]);
    const p = new DigitalOceanProvider('tok', impl);
    await p.ensureFirewall({ name: 'box-1-fw', tag: 'roostr-box-1', sshSourceCidr: null });
    expect(calls[0].body.inbound_rules).toEqual([]);
    expect(calls[0].body.outbound_rules.length).toBeGreaterThanOrEqual(3);
  });
  it('destroyFirewall issues DELETE /firewalls/{id}', async () => {
    const { impl, calls } = fakeFetch([{ status: 204 }]);
    const p = new DigitalOceanProvider('tok', impl);
    await p.destroyFirewall('fw-1');
    expect(calls[0]).toMatchObject({ method: 'DELETE', url: 'https://api.digitalocean.com/v2/firewalls/fw-1' });
  });
});
