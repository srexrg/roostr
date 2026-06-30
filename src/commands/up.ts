import type { BuildSpec, Config, ProviderName, AgentName, ProjectSource } from '../core/types.js';
import { ConfigError } from '../core/errors.js';
import type { CloudSize } from '../providers/provider.js';
import { requireConfig } from '../state/config.js';
import { getSecret } from '../state/secrets.js';
import { getProvider } from '../providers/index.js';
import { up } from '../core/orchestrator.js';
import { detectPublicIp } from '../util/public-ip.js';
import { probeTcp } from '../util/tcp.js';
import { waitForReady } from '../provisioning/readiness.js';
import { getAgentRecipe } from '../agents/index.js';
import { readFile } from 'node:fs/promises';
import { validateServerName } from '../util/validate.js';
import { githubToken, listGithubRepos } from '../util/github.js';
import { cloneFragment } from '../provisioning/git-clone.js';
import { syncLocal } from '../util/rsync.js';
import { resolveSshTarget } from './ssh.js';
import { basename } from 'node:path';
import { resolveTailscaleAuthKey } from '../provisioning/tailscale-auth.js';
import { mintTailscaleAuthKey } from '../provisioning/tailscale-api.js';

export function validateSizeRegion(sizes: CloudSize[], size: string, region: string): void {
  if (sizes.length === 0) return; // best-effort: catalog unavailable
  const match = sizes.find((s) => s.slug === size);
  if (!match) throw new ConfigError(`size ${size} not found`, 'run roostr sizes to list valid sizes');
  if (match.regions.length && !match.regions.includes(region)) {
    throw new ConfigError(`size ${size} is not available in ${region}`, 'run roostr sizes');
  }
}

export interface UpFlags {
  name: string;
  provider?: ProviderName;
  region?: string;
  size?: string;
  agent?: AgentName[];
  clone?: string | boolean;
  copy?: string;
}

export function resolveBuildSpec(config: Config, ctx: { hasToken: boolean }, flags: UpFlags): BuildSpec {
  validateServerName(flags.name);
  const provider = flags.provider ?? config.defaultProvider;
  if (!ctx.hasToken) {
    throw new ConfigError(`no API token for ${provider}`, 'run roostr init');
  }
  const defaults = config.providers[provider];
  const region = flags.region ?? defaults?.region;
  const size = flags.size ?? defaults?.size;
  if (!region || !size) throw new ConfigError(`no region/size configured for ${provider}`, 'run roostr init or pass --region/--size');
  if (flags.clone && flags.copy) throw new ConfigError('choose either --clone or --copy, not both');
  let project: ProjectSource = { kind: 'fresh' };
  if (typeof flags.clone === 'string') {
    if (!/^[\w.-]+\/[\w.-]+$/.test(flags.clone)) throw new ConfigError(`invalid repo: ${flags.clone}`, 'use owner/repo');
    project = { kind: 'clone', repo: flags.clone };
  } else if (flags.copy) {
    project = { kind: 'copy', localPath: flags.copy };
  }
  return {
    name: flags.name, provider, region, size,
    agents: flags.agent ?? config.defaultAgents,
    sshMode: config.sshMode, sshPublicKeyPath: config.sshPublicKeyPath,
    project,
  };
}

export async function runUp(flags: UpFlags): Promise<void> {
  // If --clone was passed with no value, show an interactive picker.
  if (flags.clone === true) {
    const { select } = await import('@inquirer/prompts');
    const repos = listGithubRepos();
    if (repos.length === 0) {
      throw new ConfigError('gh found no repos; pass --clone owner/repo');
    }
    flags.clone = await select({
      message: 'Pick a GitHub repo to clone:',
      choices: repos.map((r) => ({ name: r.nameWithOwner, value: r.nameWithOwner })),
    });
  }

  const config = await requireConfig();
  const provider = flags.provider ?? config.defaultProvider;
  const token = await getSecret(provider);
  const spec = resolveBuildSpec(config, { hasToken: !!token }, flags);
  const prov = getProvider(provider, { token: token! });

  const sizes = await prov.listSizes().catch(() => [] as CloudSize[]);
  validateSizeRegion(sizes, spec.size, spec.region);

  const agentRecipes = spec.agents.map(getAgentRecipe);

  let tailscaleAuthKey: string | undefined;
  if (spec.sshMode === 'tailscale') {
    tailscaleAuthKey = await resolveTailscaleAuthKey({
      getSecret,
      mint: (creds) => mintTailscaleAuthKey(creds),
    });
  }

  const claudeOauthToken = (await getSecret('claude-code')) ?? undefined;

  const extraFragments = spec.project.kind === 'clone'
    ? [cloneFragment({ repo: spec.project.repo, username: 'dev', githubToken: githubToken() ?? undefined })]
    : [];

  const rec = await up(spec, {
    provider: prov,
    readPublicKey: (p) => readFile(p, 'utf8'),
    detectPublicIp: () => detectPublicIp(),
    agentRecipes,
    tailscaleAuthKey,
    claudeOauthToken,
    extraFragments,
    waitForReady: (serverId, _server, probeHost) => waitForReady(serverId, {
      getServer: (id) => prov.getServer(id),
      probeTcp: (host, port) => probeTcp(host, port),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      now: () => Date.now(),
    }, {
      probeHost,
      onProgress: (stage, ms) => process.stderr.write(`\r  ${stage}... ${Math.round(ms / 1000)}s   `),
    }),
    now: () => new Date().toISOString(),
  });

  // For copy mode: rsync local folder after the box is up (non-fatal).
  if (spec.project.kind === 'copy') {
    const { user, host } = resolveSshTarget(rec);
    const identityFile = spec.sshPublicKeyPath.replace(/\.pub$/, '');
    try {
      await syncLocal({ localPath: spec.project.localPath, user, host, identityFile });
      console.log('  copied your folder to the box');
    } catch (e) {
      console.error('  warning: ' + (e as Error).message);
    }
  }

  process.stderr.write('\n');
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
  if (spec.project.kind === 'clone') {
    const repoName = spec.project.repo.split('/')[1];
    console.log(`\n  Your repo is at ~/${repoName} - connect with: roostr ssh ${spec.name}`);
  } else if (spec.project.kind === 'copy') {
    const folderName = basename(spec.project.localPath.replace(/\/+$/, ''));
    console.log(`\n  Your folder is at ~/${folderName} - connect with: roostr ssh ${spec.name}`);
  }
  console.log(`  From your phone: roostr mobile ${spec.name}`);
  console.log('');
}
