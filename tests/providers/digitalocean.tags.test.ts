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

describe('DigitalOcean tags + firewall-by-tag', () => {
  it('ensureTag POSTs /tags and tolerates an existing tag (422)', async () => {
    const a = fakeFetch([{ status: 201, body: { tag: { name: 'roostr-box-1' } } }]);
    await new DigitalOceanProvider('t', a.impl).ensureTag('roostr-box-1');
    expect(a.calls[0]).toMatchObject({ method: 'POST', url: 'https://api.digitalocean.com/v2/tags' });
    expect(a.calls[0].body).toEqual({ name: 'roostr-box-1' });
    const b = fakeFetch([{ status: 422, body: { id: 'unprocessable_entity', message: 'Tag already exists' } }]);
    await expect(new DigitalOceanProvider('t', b.impl).ensureTag('roostr-box-1')).resolves.toBeUndefined();
  });
  it('ensureFirewall targets a tag with empty droplet_ids', async () => {
    const { impl, calls } = fakeFetch([{ status: 202, body: { firewall: { id: 'fw-1' } } }]);
    const id = await new DigitalOceanProvider('t', impl).ensureFirewall({ name: 'box-1-fw', tag: 'roostr-box-1', sshSourceCidr: null });
    expect(id).toBe('fw-1');
    expect(calls[0].body.tags).toEqual(['roostr-box-1']);
    expect(calls[0].body.droplet_ids).toEqual([]);
    expect(calls[0].body.inbound_rules).toEqual([]);
    expect(calls[0].body.outbound_rules.length).toBeGreaterThanOrEqual(3);
  });
  it('createServer sends tags', async () => {
    const { impl, calls } = fakeFetch([{ status: 202, body: { droplet: { id: 7, status: 'new', networks: { v4: [] } } } }]);
    await new DigitalOceanProvider('t', impl).createServer({
      name: 'box-1', region: 'nyc1', size: 's-1vcpu-1gb', image: 'ubuntu-24-04-x64',
      sshKeyIds: ['1'], userData: '#cloud-config\n', tags: ['roostr-box-1'],
    });
    expect(calls[0].body.tags).toEqual(['roostr-box-1']);
  });
});
