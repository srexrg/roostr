import { confirm } from '@inquirer/prompts';
import { requireConfig } from '../state/config.js';
import { getSecret } from '../state/secrets.js';
import { getProvider } from '../providers/index.js';
import { destroyServer } from '../core/orchestrator.js';
import { getServerRecord } from '../state/store.js';

export async function runDestroy(name: string, opts: { yes?: boolean }): Promise<void> {
  const record = await getServerRecord(name);
  if (!record) { console.error(`No server named ${name}. Run: roostr status`); process.exitCode = 1; return; }
  if (!opts.yes) {
    const ok = await confirm({ message: `Destroy ${name} (${record.provider} ${record.providerServerId}) on the provider? This deletes the box.`, default: false });
    if (!ok) { console.log('Aborted.'); return; }
  }
  const config = await requireConfig();
  const token = await getSecret(record.provider);
  const prov = getProvider(record.provider, { token: token ?? '' });
  await destroyServer(name, { provider: prov });
  console.log(`Destroyed ${name}.`);
}
