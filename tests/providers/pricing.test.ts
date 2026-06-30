import { describe, it, expect } from 'bun:test';
import { priceFromCatalog } from '../../src/providers/pricing.js';
import type { CloudSize } from '../../src/providers/provider.js';

const sizes: CloudSize[] = [
  { slug: 's-2vcpu-4gb', vcpus: 2, memoryGB: 4, diskGB: 80, priceMonthly: 24, currency: 'USD', arch: 'unknown', regions: ['nyc1'] },
];

describe('priceFromCatalog', () => {
  it('returns price + currency for a known slug', () => {
    expect(priceFromCatalog(sizes, 's-2vcpu-4gb')).toEqual({ price: 24, currency: 'USD' });
  });
  it('returns null for an unknown slug', () => {
    expect(priceFromCatalog(sizes, 'nope')).toBeNull();
  });
});
