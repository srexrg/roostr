import { describe, it, expect } from 'bun:test';
import { validateSizeRegion } from '../../src/commands/up.js';
import { ConfigError } from '../../src/core/errors.js';
import type { CloudSize } from '../../src/providers/provider.js';

const sizes: CloudSize[] = [
  { slug: 's-2vcpu-4gb', vcpus: 2, memoryGB: 4, diskGB: 80, priceMonthly: 24, currency: 'USD', arch: 'unknown', regions: ['nyc1', 'sfo3'] },
];

describe('validateSizeRegion', () => {
  it('passes for a valid size + region', () => {
    expect(() => validateSizeRegion(sizes, 's-2vcpu-4gb', 'nyc1')).not.toThrow();
  });
  it('throws for an unknown size', () => {
    expect(() => validateSizeRegion(sizes, 'nope', 'nyc1')).toThrow(ConfigError);
  });
  it('throws when the size is not available in the region', () => {
    expect(() => validateSizeRegion(sizes, 's-2vcpu-4gb', 'lon1')).toThrow(ConfigError);
  });
  it('does nothing when the catalog is empty (best-effort)', () => {
    expect(() => validateSizeRegion([], 'anything', 'anywhere')).not.toThrow();
  });
});
