import type { BuildSpec, Config, ProviderName, AgentName } from '../core/types.js';
import { ConfigError } from '../core/errors.js';
import { requireConfig } from '../state/config.js';
import { getSecret } from '../state/secrets.js';
import { getProvider } from '../providers/index.js';
import { up } from '../core/orchestrator.js';
import { detectPublicIp } from '../util/public-ip.js';
import { probeTcp } from '../util/tcp.js';
import { waitForReady } from '../provisioning/readiness.js';
import { readFile } from 'node:fs/promises';

export interface UpFlags {
  name: string;
  provider?: ProviderName;
  region?: string;
  size?: string;
  agent?: AgentName[];
}

export function resolveBuildSpec(config: Config, ctx: { hasToken: boolean }, flags: UpFlags): BuildSpec {
  const provider = flags.provider ?? config.defaultProvider;
  if (!ctx.hasToken) {
    throw new ConfigError(`no API token for ${provider}`, 'run roostr init');
  }
  const defaults = config.providers[provider];
  const region = flags.region ?? defaults?.region;
  const size = flags.size ?? defaults?.size;
  if (!region || !size) throw new ConfigError(`no region/size configured for ${provider}`, 'run roostr init or pass --region/--size');
  return {
    name: flags.name, provider, region, size,
    agents: flags.agent ?? config.defaultAgents,
    sshMode: config.sshMode, sshPublicKeyPath: config.sshPublicKeyPath,
  };
}

export async function runUp(flags: UpFlags): Promise<void> {
  const config = await requireConfig();
  const provider = flags.provider ?? config.defaultProvider;
  const token = await getSecret(provider);
  const spec = resolveBuildSpec(config, { hasToken: !!token }, flags);
  const prov = getProvider(provider, { token: token! });

  const rec = await up(spec, {
    provider: prov,
    readPublicKey: (p) => readFile(p, 'utf8'),
    detectPublicIp: () => detectPublicIp(),
    // UpDeps.waitForReady signature is (serverId, server) => Promise<ProviderServer>.
    // The actual waitForReady impl polls via deps.getServer; the initial server param is not needed.
    waitForReady: (serverId, _server) => waitForReady(serverId, {
      getServer: (id) => prov.getServer(id),
      probeTcp: (host, port) => probeTcp(host, port),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      now: () => Date.now(),
    }),
    now: () => new Date().toISOString(),
  });

  console.log(`\n  ${rec.name} is up at ${rec.publicIp}`);
  console.log(`  Connect:  ssh dev@${rec.publicIp}`);
  console.log(`  Then:     tmux attach   (agents + Tailscale land in a later release)\n`);
}
