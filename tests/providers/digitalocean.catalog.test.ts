import { describe, it, expect } from 'bun:test';
import { DigitalOceanProvider } from '../../src/providers/digitalocean.js';

function fakeFetch(responses: Array<{ status: number; body?: unknown }>) {
  const calls: Array<{ url: string }> = [];
  const impl = (async (url: string) => {
    calls.push({ url });
    const n = responses.shift()!;
    return new Response(n.body === undefined ? '' : JSON.stringify(n.body), { status: n.status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('DigitalOcean catalog', () => {
  it('listSizes maps MB->GB and USD', async () => {
    const { impl, calls } = fakeFetch([{ status: 200, body: { sizes: [
      { slug: 's-1vcpu-1gb', vcpus: 1, memory: 1024, disk: 25, price_monthly: 6, regions: ['nyc1'], available: true, description: 'Basic' },
    ] } }]);
    const sizes = await new DigitalOceanProvider('t', impl).listSizes();
    expect(calls[0].url).toContain('/sizes');
    expect(sizes[0]).toEqual({ slug: 's-1vcpu-1gb', vcpus: 1, memoryGB: 1, diskGB: 25, priceMonthly: 6, currency: 'USD', arch: 'unknown', regions: ['nyc1'], description: 'Basic', available: true });
  });
  it('listRegions maps slug/name/available', async () => {
    const { impl } = fakeFetch([{ status: 200, body: { regions: [{ slug: 'nyc1', name: 'New York 1', available: true, sizes: [] }] } }]);
    expect(await new DigitalOceanProvider('t', impl).listRegions()).toEqual([{ slug: 'nyc1', name: 'New York 1', available: true }]);
  });
});
