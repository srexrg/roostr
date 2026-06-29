import { describe, it, expect } from 'bun:test';
import { detectPublicIp } from '../../src/util/public-ip.js';
import { ConnectivityError } from '../../src/core/errors.js';

describe('detectPublicIp', () => {
  it('returns the ip field from ipify', async () => {
    const impl = (async () => new Response(JSON.stringify({ ip: '203.0.113.7' }), { status: 200 })) as unknown as typeof fetch;
    expect(await detectPublicIp(impl)).toBe('203.0.113.7');
  });
  it('throws ConnectivityError on a non-200', async () => {
    const impl = (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    await expect(detectPublicIp(impl)).rejects.toBeInstanceOf(ConnectivityError);
  });
});
