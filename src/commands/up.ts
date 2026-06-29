import type { BuildSpec, Config, ProviderName, AgentName } from '../core/types.js';
import { ConfigError } from '../core/errors.js';
import { requireConfig } from '../state/config.js';
import { getSecret } from '../state/secrets.js';
import { getProvider } from '../providers/index.js';
import { up } from '../core/orchestrator.js';
import { detectPublicIp } from '../util/public-ip.js';
import { probeTcp } from '../util/tcp.js';
import { waitForReady } from '../provisioning/readiness.js';
import { getAgentRecipe } from '../agents/index.js';
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

  const agentRecipes = spec.agents.map(getAgentRecipe);

  let tailscaleAuthKey: string | undefined;
  if (spec.sshMode === 'tailscale') {
    tailscaleAuthKey = (await getSecret('tailscale')) ?? undefined;
    if (!tailscaleAuthKey) {
      throw new ConfigError('no Tailscale auth key', 'run roostr init and choose tailscale mode');
    }
  }

  const claudeOauthToken = (await getSecret('claude-code')) ?? undefined;

  const rec = await up(spec, {
    provider: prov,
    readPublicKey: (p) => readFile(p, 'utf8'),
    detectPublicIp: () => detectPublicIp(),
    agentRecipes,
    tailscaleAuthKey,
    claudeOauthToken,
    waitForReady: (serverId, _server, probeHost) => waitForReady(serverId, {
      getServer: (id) => prov.getServer(id),
      probeTcp: (host, port) => probeTcp(host, port),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      now: () => Date.now(),
    }, { probeHost }),
    now: () => new Date().toISOString(),
  });

  console.log(`\n  ${rec.name} is up`);
  if (spec.sshMode === 'tailscale') {
    console.log(`  Connect via roostr: roostr ssh ${spec.name}`);
    console.log(`  Connect directly:   ssh dev@${spec.name}`);
    console.log(`  (Tailscale must be running on your device to connect)`);
  } else {
    console.log(`  Connect via roostr: roostr ssh ${spec.name}`);
    console.log(`  Connect directly:   ssh dev@${rec.publicIp}`);
  }
  for (const recipe of agentRecipes) {
    console.log(`\n  ${recipe.name}: ${recipe.firstRunHint({ hasToken: !!claudeOauthToken })}`);
  }
  console.log('');
}
