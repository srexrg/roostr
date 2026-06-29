import { describe, it, expect } from 'bun:test';
import { monthlyCostUsd } from '../../src/providers/pricing.js';

describe('monthlyCostUsd', () => {
  it('returns the estimate for a known DigitalOcean size', () => {
    expect(monthlyCostUsd('digitalocean', 's-2vcpu-4gb')).toBe(24);
  });
  it('returns null for an unknown size', () => {
    expect(monthlyCostUsd('digitalocean', 's-99vcpu-huge')).toBeNull();
  });
});
