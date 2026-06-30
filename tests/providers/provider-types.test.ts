import { describe, it, expect } from 'bun:test';
import type { CloudSize, CloudRegion } from '../../src/providers/provider.js';

describe('catalog types', () => {
  it('CloudSize and CloudRegion are shaped as expected', () => {
    const s: CloudSize = { slug: 's-1vcpu-1gb', vcpus: 1, memoryGB: 1, diskGB: 25, priceMonthly: 6, currency: 'USD', arch: 'unknown', regions: ['nyc1'] };
    const r: CloudRegion = { slug: 'nyc1', name: 'New York 1', available: true };
    expect(s.currency).toBe('USD');
    expect(r.available).toBe(true);
  });
});
