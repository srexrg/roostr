import { describe, it, expect } from 'bun:test';
import { formatSize, regionChoices, sizeChoices } from '../../src/onboarding/catalog-select.js';
import type { CloudSize, CloudRegion } from '../../src/providers/provider.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSize(overrides: Partial<CloudSize> & { slug: string }): CloudSize {
  return {
    vcpus: 2,
    memoryGB: 4,
    diskGB: 80,
    priceMonthly: 24,
    currency: 'USD',
    arch: 'x86',
    regions: ['nyc1', 'sfo2'],
    available: true,
    ...overrides,
  };
}

const sBasic: CloudSize = makeSize({ slug: 's-2vcpu-4gb', priceMonthly: 24 });
const sCheap: CloudSize = makeSize({ slug: 's-1vcpu-2gb', vcpus: 1, memoryGB: 2, diskGB: 40, priceMonthly: 12 });
const sCompute: CloudSize = makeSize({ slug: 'c-2', vcpus: 2, memoryGB: 4, diskGB: 50, priceMonthly: 30 });
const sOtherRegion: CloudSize = makeSize({ slug: 's-4vcpu-8gb', vcpus: 4, memoryGB: 8, diskGB: 160, priceMonthly: 48, regions: ['lon1'] });
const sUnavailable: CloudSize = makeSize({ slug: 's-2vcpu-2gb', vcpus: 2, memoryGB: 2, diskGB: 40, priceMonthly: 20, available: false });
const sOnlySFO: CloudSize = makeSize({ slug: 'c-4', vcpus: 4, memoryGB: 8, diskGB: 100, priceMonthly: 60, regions: ['sfo2'] });

const regionNYC1: CloudRegion = { slug: 'nyc1', name: 'New York 1', available: true };
const regionSFO2: CloudRegion = { slug: 'sfo2', name: 'San Francisco 2', available: true };
const regionUnavail: CloudRegion = { slug: 'ams3', name: 'Amsterdam 3', available: false };

// ---------------------------------------------------------------------------
// formatSize
// ---------------------------------------------------------------------------

describe('formatSize', () => {
  it('includes the slug', () => {
    expect(formatSize(sBasic)).toContain('s-2vcpu-4gb');
  });

  it('includes vcpus', () => {
    expect(formatSize(sBasic)).toContain('2');
  });

  it('includes memoryGB', () => {
    expect(formatSize(sBasic)).toContain('4');
  });

  it('includes diskGB', () => {
    expect(formatSize(sBasic)).toContain('80');
  });

  it('includes priceMonthly', () => {
    expect(formatSize(sBasic)).toContain('24');
  });

  it('includes currency', () => {
    expect(formatSize(sBasic)).toContain('USD');
  });

  it('formats a cheap size correctly', () => {
    const result = formatSize(sCheap);
    expect(result).toContain('s-1vcpu-2gb');
    expect(result).toContain('12');
    expect(result).toContain('USD');
  });
});

// ---------------------------------------------------------------------------
// regionChoices
// ---------------------------------------------------------------------------

describe('regionChoices', () => {
  it('drops regions with available === false', () => {
    const choices = regionChoices([regionNYC1, regionSFO2, regionUnavail]);
    expect(choices.map(c => c.value)).not.toContain('ams3');
    expect(choices).toHaveLength(2);
  });

  it('sets value to slug', () => {
    const choices = regionChoices([regionNYC1, regionSFO2]);
    expect(choices[0].value).toBe('nyc1');
    expect(choices[1].value).toBe('sfo2');
  });

  it('name contains both human name and slug', () => {
    const choices = regionChoices([regionNYC1]);
    expect(choices[0].name).toContain('New York 1');
    expect(choices[0].name).toContain('nyc1');
  });

  it('preserves input order', () => {
    const choices = regionChoices([regionSFO2, regionNYC1]);
    expect(choices[0].value).toBe('sfo2');
    expect(choices[1].value).toBe('nyc1');
  });

  it('returns empty array if all are unavailable', () => {
    expect(regionChoices([regionUnavail])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// sizeChoices - curated (default)
// ---------------------------------------------------------------------------

describe('sizeChoices (default/curated)', () => {
  const allSizes = [sBasic, sCheap, sCompute, sOtherRegion, sUnavailable, sOnlySFO];

  it('returns only sizes whose regions includes regionSlug', () => {
    const choices = sizeChoices(allSizes, 'nyc1');
    const slugs = choices.map(c => c.value);
    // sOtherRegion only in lon1, sOnlySFO only in sfo2, so neither should appear
    expect(slugs).not.toContain('s-4vcpu-8gb');
    expect(slugs).not.toContain('c-4');
  });

  it('curated default: only s-* slugs', () => {
    const choices = sizeChoices(allSizes, 'nyc1');
    for (const c of choices) {
      expect(c.value).toMatch(/^s-/);
    }
  });

  it('excludes sizes with available === false', () => {
    const choices = sizeChoices(allSizes, 'nyc1');
    expect(choices.map(c => c.value)).not.toContain('s-2vcpu-2gb');
  });

  it('first result is the cheapest s-* size', () => {
    const choices = sizeChoices(allSizes, 'nyc1');
    expect(choices[0].value).toBe('s-1vcpu-2gb'); // priceMonthly 12
  });

  it('sorts all returned choices cheapest-first', () => {
    const choices = sizeChoices(allSizes, 'nyc1');
    for (let i = 1; i < choices.length; i++) {
      const prev = allSizes.find(s => s.slug === choices[i - 1].value)!;
      const curr = allSizes.find(s => s.slug === choices[i].value)!;
      expect(prev.priceMonthly).toBeLessThanOrEqual(curr.priceMonthly);
    }
  });

  it('value is the slug and name is the formatted string', () => {
    const choices = sizeChoices([sBasic], 'nyc1');
    expect(choices[0].value).toBe('s-2vcpu-4gb');
    expect(choices[0].name).toContain('s-2vcpu-4gb');
  });

  it('falls back to all available sizes when no s-* exists in region', () => {
    // Only non-s-* available in lon1
    const lon1Only = [
      makeSize({ slug: 'c-2-lon1', vcpus: 2, memoryGB: 4, diskGB: 50, priceMonthly: 30, regions: ['lon1'] }),
      makeSize({ slug: 'g-2vcpu-8gb', vcpus: 2, memoryGB: 8, diskGB: 50, priceMonthly: 40, regions: ['lon1'] }),
    ];
    const choices = sizeChoices(lon1Only, 'lon1');
    expect(choices.length).toBeGreaterThan(0);
    expect(choices.map(c => c.value)).toContain('c-2-lon1');
  });
});

// ---------------------------------------------------------------------------
// sizeChoices - all mode
// ---------------------------------------------------------------------------

describe('sizeChoices (all: true)', () => {
  const allSizes = [sBasic, sCheap, sCompute, sOtherRegion, sUnavailable, sOnlySFO];

  it('includes non-s-* sizes available in the region', () => {
    const choices = sizeChoices(allSizes, 'nyc1', { all: true });
    expect(choices.map(c => c.value)).toContain('c-2');
  });

  it('still excludes sizes not in the region', () => {
    const choices = sizeChoices(allSizes, 'nyc1', { all: true });
    expect(choices.map(c => c.value)).not.toContain('s-4vcpu-8gb'); // lon1 only
    expect(choices.map(c => c.value)).not.toContain('c-4');          // sfo2 only
  });

  it('still excludes available === false sizes', () => {
    const choices = sizeChoices(allSizes, 'nyc1', { all: true });
    expect(choices.map(c => c.value)).not.toContain('s-2vcpu-2gb');
  });

  it('sorted cheapest-first', () => {
    const choices = sizeChoices(allSizes, 'nyc1', { all: true });
    for (let i = 1; i < choices.length; i++) {
      const prev = allSizes.find(s => s.slug === choices[i - 1].value)!;
      const curr = allSizes.find(s => s.slug === choices[i].value)!;
      expect(prev.priceMonthly).toBeLessThanOrEqual(curr.priceMonthly);
    }
  });

  it('first choice is cheapest overall (not just curated)', () => {
    const choices = sizeChoices(allSizes, 'nyc1', { all: true });
    expect(choices[0].value).toBe('s-1vcpu-2gb'); // still 12/mo
  });
});
