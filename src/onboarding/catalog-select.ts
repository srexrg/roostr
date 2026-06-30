import type { CloudSize, CloudRegion } from '../providers/provider.js';

export interface SelectChoice {
  value: string;
  name: string;
}

/**
 * Format a single size as a human-readable label.
 * Example: "s-2vcpu-4gb   2 vCPU / 4 GB / 80 GB   ~$24 USD/mo"
 */
export function formatSize(s: CloudSize): string {
  const price = `~$${s.priceMonthly} ${s.currency}/mo`;
  return `${s.slug}   ${s.vcpus} vCPU / ${s.memoryGB} GB / ${s.diskGB} GB   ${price}`;
}

/**
 * Convert a list of regions into SelectChoice items.
 * Drops regions with available === false, preserves input order.
 */
export function regionChoices(regions: CloudRegion[]): SelectChoice[] {
  return regions
    .filter(r => r.available)
    .map(r => ({ value: r.slug, name: `${r.name} (${r.slug})` }));
}

/**
 * Convert a list of sizes into SelectChoice items for a given region.
 *
 * Default (all !== true): curated set - only sizes whose slug starts with "s-".
 * If the curated set is empty for that region, fall back to all sizes in the region.
 * all === true: every size available in the region.
 *
 * In all cases:
 * - Excludes sizes whose `regions` does not include regionSlug.
 * - Excludes sizes with available === false.
 * - Sorted cheapest-first (ascending priceMonthly).
 */
export function sizeChoices(
  sizes: CloudSize[],
  regionSlug: string,
  opts?: { all?: boolean },
): SelectChoice[] {
  const inRegion = sizes.filter(
    s => s.available !== false && s.regions.includes(regionSlug),
  );

  let candidates: CloudSize[];

  if (opts?.all) {
    candidates = inRegion;
  } else {
    const curated = inRegion.filter(s => s.slug.startsWith('s-'));
    candidates = curated.length > 0 ? curated : inRegion;
  }

  return candidates
    .slice()
    .sort((a, b) => a.priceMonthly - b.priceMonthly)
    .map(s => ({ value: s.slug, name: formatSize(s) }));
}
