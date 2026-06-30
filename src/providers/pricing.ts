import type { CloudSize } from './provider.js';

export function priceFromCatalog(sizes: CloudSize[], slug: string): { price: number; currency: string } | null {
  const s = sizes.find((x) => x.slug === slug);
  return s ? { price: s.priceMonthly, currency: s.currency } : null;
}
