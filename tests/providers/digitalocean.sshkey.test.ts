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

const KEY = 'ssh-ed25519 AAAAC3Nza...AAA user@host';

describe('DigitalOceanProvider.ensureSshKey', () => {
  it('returns the id of an existing matching key without creating one', async () => {
    const { impl, calls } = fakeFetch([
      { status: 200, body: { ssh_keys: [{ id: 289794, fingerprint: 'aa:bb', public_key: KEY, name: 'old' }] } },
    ]);
    const p = new DigitalOceanProvider('tok', impl);
    expect(await p.ensureSshKey('roostr', KEY)).toBe('289794');
    expect(calls).toHaveLength(1); // only the GET, no POST
    expect(calls[0].method).toBe('GET');
  });

  it('creates the key when none matches and returns the new id', async () => {
    const { impl, calls } = fakeFetch([
      { status: 200, body: { ssh_keys: [{ id: 1, public_key: 'ssh-rsa OTHER', name: 'x' }] } },
      { status: 201, body: { ssh_key: { id: 512189, fingerprint: 'cc:dd', public_key: KEY, name: 'roostr' } } },
    ]);
    const p = new DigitalOceanProvider('tok', impl);
    expect(await p.ensureSshKey('roostr', KEY)).toBe('512189');
    expect(calls[1].method).toBe('POST');
    expect(calls[1].url).toBe('https://api.digitalocean.com/v2/account/keys');
    expect(calls[1].body).toEqual({ name: 'roostr', public_key: KEY });
  });
});
