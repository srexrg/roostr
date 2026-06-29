import { describe, it, expect } from 'bun:test';
import { getProvider } from '../../src/providers/index.js';
import { DigitalOceanProvider } from '../../src/providers/digitalocean.js';
import { ProviderError } from '../../src/core/errors.js';

describe('getProvider', () => {
  it('returns a DigitalOceanProvider for digitalocean', () => {
    expect(getProvider('digitalocean', { token: 'tok' })).toBeInstanceOf(DigitalOceanProvider);
  });
  it('throws ProviderError for the not-yet-implemented hetzner', () => {
    expect(() => getProvider('hetzner', { token: 'tok' })).toThrow(ProviderError);
  });
});
