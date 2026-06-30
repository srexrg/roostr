import type { ProviderName } from '../core/types.js';
import { requireConfig } from '../state/config.js';
import { getSecret } from '../state/secrets.js';
import { getProvider } from '../providers/index.js';

export async function runSizes(provider?: ProviderName): Promise<void> {
  const config = await requireConfig();
  const p = provider ?? config.defaultProvider;
  const token = await getSecret(p);
  if (!token) {
    console.error(`No API token for ${p}. Run: roostr init`);
    process.exitCode = 1;
    return;
  }
  const sizes = await getProvider(p, { token }).listSizes();
  const rows = [...sizes].sort((a, b) => a.priceMonthly - b.priceMonthly);
  console.log(`${p} sizes (live):`);
  for (const s of rows) {
    console.log(
      `  ${s.slug.padEnd(16)} ${String(s.vcpus).padStart(2)}vcpu ${String(s.memoryGB).padStart(4)}GB ${String(s.diskGB).padStart(4)}GB disk  ~${s.priceMonthly} ${s.currency}/mo  (${s.regions.length} regions)`,
    );
  }
}
