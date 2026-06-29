import type { ProviderName } from '../core/types.js';

// Static monthly USD estimates (NOT a billing API). Update as provider pricing changes.
const PRICES: Record<ProviderName, Record<string, number>> = {
  digitalocean: {
    's-1vcpu-1gb': 6,
    's-1vcpu-2gb': 12,
    's-2vcpu-2gb': 18,
    's-2vcpu-4gb': 24,
    's-4vcpu-8gb': 48,
  },
  hetzner: {}, // populated in Plan 4
};

export function monthlyCostUsd(provider: ProviderName, size: string): number | null {
  return PRICES[provider]?.[size] ?? null;
}
