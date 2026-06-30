import type { BuildSpec, ServerRecord, ProviderName } from './types.js';
import type { Provider, ProviderServer, ServerState } from '../providers/provider.js';
import { upsertServer, listServers, getServerRecord, removeServer } from '../state/store.js';
import { buildCloudInit } from '../provisioning/cloud-init.js';
import { tailscaleFragment } from '../provisioning/tailscale.js';
import { ProviderError } from './errors.js';
import { monthlyCostUsd } from '../providers/pricing.js';

const DO_IMAGE = 'ubuntu-24-04-x64';

export interface UpDeps {
  provider: Provider;
  readPublicKey: (path: string) => Promise<string>;
  detectPublicIp: () => Promise<string>;
  waitForReady: (serverId: string, server: ProviderServer, probeHost?: string) => Promise<ProviderServer>;
  now: () => string;
  agentRecipes: import('../agents/recipe.js').AgentRecipe[];
  tailscaleAuthKey?: string;
  claudeOauthToken?: string;
  extraFragments?: import('../agents/recipe.js').CloudInitFragment[];
}

export async function up(spec: BuildSpec, deps: UpDeps): Promise<ServerRecord> {
  const publicKey = await deps.readPublicKey(spec.sshPublicKeyPath);
  const keyId = await deps.provider.ensureSshKey('roostr', publicKey);
  const isTailscale = spec.sshMode === 'tailscale';

  const fragments = [
    ...(isTailscale && deps.tailscaleAuthKey
      ? [tailscaleFragment({ authKey: deps.tailscaleAuthKey, hostname: spec.name })]
      : []),
    ...deps.agentRecipes.map((r) => r.fragment({ username: 'dev', oauthToken: deps.claudeOauthToken })),
    ...(deps.extraFragments ?? []),
  ];
  const userData = buildCloudInit({ username: 'dev', sshPublicKey: publicKey, fragments });

  const tag = `roostr-${spec.name}`;
  await deps.provider.ensureTag(tag);
  const sshSourceCidr = isTailscale ? null : `${await deps.detectPublicIp()}/32`;
  const firewallId = await deps.provider.ensureFirewall({ name: `${spec.name}-fw`, tag, sshSourceCidr });

  let created;
  try {
    created = await deps.provider.createServer({
      name: spec.name, region: spec.region, size: spec.size, image: DO_IMAGE,
      sshKeyIds: [keyId], userData, tags: [tag],
    });
  } catch (err) {
    try { await deps.provider.destroyFirewall(firewallId); } catch { /* best-effort orphan cleanup */ }
    throw err;
  }

  // Track the box the instant it exists, BEFORE anything else can fail.
  const record: ServerRecord = {
    name: spec.name, provider: spec.provider, providerServerId: created.id,
    region: spec.region, size: spec.size, sshMode: spec.sshMode,
    tailscaleName: isTailscale ? spec.name : null, publicIp: created.publicIp, agents: spec.agents,
    createdAt: deps.now(), lastSetupAt: null, status: 'incomplete',
    snapshotId: null, hibernatedAt: null, firewallId,
  };
  await upsertServer(record);

  const ready = await deps.waitForReady(created.id, created, isTailscale ? spec.name : undefined);
  const finalRecord: ServerRecord = { ...record, status: 'active', publicIp: ready.publicIp, lastSetupAt: deps.now() };
  await upsertServer(finalRecord);
  return finalRecord;
}

export async function destroyServer(name: string, deps: { provider: Provider }): Promise<void> {
  const record = await getServerRecord(name);
  if (!record) throw new ProviderError(`no server named ${name}`, 'run roostr status');
  if (record.firewallId) {
    try { await deps.provider.destroyFirewall(record.firewallId); }
    catch { /* best-effort: a missing/already-deleted firewall must not block teardown */ }
  }
  await deps.provider.destroyServer(record.providerServerId);
  await removeServer(name);
}

export interface StatusView {
  name: string;
  provider: string;
  region: string;
  size: string;
  recordedStatus: string;
  liveState: ServerState | 'gone';
  publicIp: string | null;
  monthlyCostUsd: number | null;
}

export async function status(deps: { provider: Provider }, name?: string): Promise<StatusView[]> {
  const all = await listServers();
  const records = name ? all.filter((r) => r.name === name) : all;
  const views: StatusView[] = [];
  for (const r of records) {
    const live = await deps.provider.getServer(r.providerServerId);
    views.push({
      name: r.name, provider: r.provider, region: r.region, size: r.size,
      recordedStatus: r.status,
      liveState: live ? live.state : 'gone',
      publicIp: live?.publicIp ?? r.publicIp,
      monthlyCostUsd: monthlyCostUsd(r.provider as ProviderName, r.size),
    });
  }
  return views;
}
