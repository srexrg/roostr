import { requireConfig } from '../state/config.js';
import { getSecret } from '../state/secrets.js';
import { getProvider } from '../providers/index.js';
import { status } from '../core/orchestrator.js';

export async function runStatus(name?: string): Promise<void> {
  const config = await requireConfig();
  const token = await getSecret(config.defaultProvider);
  const prov = getProvider(config.defaultProvider, { token: token ?? '' });
  const views = await status({ provider: prov }, name);
  if (views.length === 0) { console.log('No servers. Run: roostr up'); return; }
  for (const v of views) {
    const cost = v.monthlyCost === null ? 'unknown' : `~${v.monthlyCost} ${v.currency}/mo (live)`;
    console.log(`${v.name}  [${v.provider} ${v.size} ${v.region}]  live=${v.liveState}  ip=${v.publicIp ?? '-'}  ${cost}`);
    if (v.liveState === 'gone') console.log('   (drifted: not found on provider - consider roostr destroy to prune)');
    else if (v.publicIp) console.log(`   ssh dev@${v.publicIp}  &&  tmux attach`);
  }
  console.log(`\n${views.length} server(s). Remember these are billing while they exist.`);
}
