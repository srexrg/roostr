import { describe, it, expect } from 'bun:test';
import { DigitalOceanProvider, ProviderHttpError } from '../../src/providers/digitalocean.js';

// Build a fake fetch that returns queued responses and records requests.
function fakeFetch(responses: Array<{ status: number; body?: unknown }>) {
  const calls: Array<{ url: string; method: string; body: any }> = [];
  const impl = (async (url: string, init: any = {}) => {
    calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined });
    const next = responses.shift()!;
    return new Response(next.body === undefined ? '' : JSON.stringify(next.body), { status: next.status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('DigitalOceanProvider lifecycle', () => {
  it('createServer posts the droplet body and maps the new droplet', async () => {
    const { impl, calls } = fakeFetch([{ status: 202, body: { droplet: { id: 3164444, status: 'new', networks: { v4: [] } } } }]);
    const p = new DigitalOceanProvider('tok', impl);
    const s = await p.createServer({ name: 'box-1', region: 'nyc1', size: 's-2vcpu-4gb', image: 'ubuntu-24-04-x64', sshKeyIds: ['289794'], userData: '#cloud-config\n' });
    expect(s).toEqual({ id: '3164444', state: 'provisioning', publicIp: null });
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('https://api.digitalocean.com/v2/droplets');
    expect(calls[0].body).toEqual({ name: 'box-1', region: 'nyc1', size: 's-2vcpu-4gb', image: 'ubuntu-24-04-x64', ssh_keys: [289794], user_data: '#cloud-config\n' });
  });

  it('getServer maps active status and extracts the public IPv4', async () => {
    const { impl } = fakeFetch([{ status: 200, body: { droplet: { id: 1, status: 'active', networks: { v4: [
      { ip_address: '10.0.0.2', type: 'private' }, { ip_address: '203.0.113.7', type: 'public' },
    ] } } } }]);
    const p = new DigitalOceanProvider('tok', impl);
    expect(await p.getServer('1')).toEqual({ id: '1', state: 'running', publicIp: '203.0.113.7' });
  });

  it('getServer returns null on 404', async () => {
    const { impl } = fakeFetch([{ status: 404, body: { id: 'not_found', message: 'The resource you were accessing could not be found.' } }]);
    const p = new DigitalOceanProvider('tok', impl);
    expect(await p.getServer('999')).toBeNull();
  });

  it('destroyServer succeeds on 204', async () => {
    const { impl, calls } = fakeFetch([{ status: 204 }]);
    const p = new DigitalOceanProvider('tok', impl);
    await p.destroyServer('1');
    expect(calls[0]).toMatchObject({ method: 'DELETE', url: 'https://api.digitalocean.com/v2/droplets/1' });
  });

  it('throws ProviderHttpError with status on auth failure', async () => {
    const { impl } = fakeFetch([{ status: 401, body: { id: 'unauthorized', message: 'Unable to authenticate you.' } }]);
    const p = new DigitalOceanProvider('tok', impl);
    await expect(p.listServers()).rejects.toBeInstanceOf(ProviderHttpError);
  });
});
