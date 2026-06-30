import type { AgentName, Config, ProviderName, SshMode } from '../core/types.js';
import { saveConfig } from '../state/config.js';
import { setSecret } from '../state/secrets.js';
import { select, input, password, checkbox, confirm, search } from '@inquirer/prompts';
import { AGENT_NAMES } from '../core/types.js';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { readDoctlToken } from '../util/doctl.js';
import { runPreflight } from '../onboarding/preflight.js';
import { buildPreflightDeps } from '../onboarding/preflight-deps.js';
import { getProvider } from '../providers/index.js';
import type { CloudSize, CloudRegion } from '../providers/provider.js';
import { regionChoices, sizeChoices } from '../onboarding/catalog-select.js';
import { isAuthError, tokenGuidance } from '../onboarding/token-help.js';

export interface InitAnswers {
  provider: ProviderName;
  token: string;
  region: string;
  size: string;
  sshMode: SshMode;
  tailscaleAuthKey?: string;
  agents: AgentName[];
  sshPublicKeyPath: string;
  claudeOauthToken?: string;
}

export function buildConfigFromAnswers(a: InitAnswers): Config {
  return {
    defaultProvider: a.provider,
    providers: { [a.provider]: { region: a.region, size: a.size } },
    defaultAgents: a.agents,
    sshMode: a.sshMode,
    sshPublicKeyPath: a.sshPublicKeyPath,
  };
}

export async function persistInit(a: InitAnswers): Promise<void> {
  await saveConfig(buildConfigFromAnswers(a));
  await setSecret(a.provider, a.token);
  if (a.tailscaleAuthKey) await setSecret('tailscale', a.tailscaleAuthKey);
  if (a.claudeOauthToken) await setSecret('claude-code', a.claudeOauthToken);
}

export async function runInit(): Promise<void> {
  const provider = await select({
    message: 'Cloud provider',
    choices: [
      { value: 'digitalocean' as const, name: 'DigitalOcean', description: 'Fully supported - recommended for new users' },
      { value: 'hetzner' as const, name: 'Hetzner', description: 'Not yet supported - coming soon' },
    ],
  });
  let token = '';
  let catalog: { regions: CloudRegion[]; sizes: CloudSize[] } | null = null;
  let firstAttempt = true;
  for (;;) {
    // acquire token
    let reused = false;
    if (firstAttempt && provider === 'digitalocean') {
      const found = await readDoctlToken();
      if (found !== null && (await confirm({ message: 'Found a doctl token - use it?', default: true }))) {
        token = found; reused = true;
      }
    }
    if (!reused) {
      for (const line of tokenGuidance(provider)) console.log(line);
      token = await password({ message: `${provider} API token` });
    }
    firstAttempt = false;

    // validate by fetching the catalog (doubles as the size/region source)
    try {
      const prov = getProvider(provider, { token });
      const [regions, sizes] = await Promise.all([prov.listRegions(), prov.listSizes()]);
      if (regions.length > 0 && sizes.length > 0) catalog = { regions, sizes };
      break; // token accepted (even if catalog is empty, the call succeeded)
    } catch (err) {
      if (isAuthError(err)) {
        console.log('That token was rejected (needs Write / full access). Please try again.');
        catalog = null;
        continue; // re-prompt
      }
      // offline / non-auth / provider without a catalog (e.g. hetzner) - cannot validate now, do not block
      console.log('Could not validate the token against the provider right now - continuing.');
      catalog = null;
      break;
    }
  }

  let region: string;
  let size: string;
  if (catalog) {
    region = await select({ message: 'Region', choices: regionChoices(catalog.regions) });
    const curated = sizeChoices(catalog.sizes, region);
    const SHOW_ALL = '__show_all__';
    const sizePick = await select({
      message: 'Server size (cheapest first)',
      choices: [...curated, { value: SHOW_ALL, name: 'Show all sizes (type to filter)' }],
    });
    if (sizePick === SHOW_ALL) {
      const all = sizeChoices(catalog.sizes, region, { all: true });
      size = await search({
        message: 'Server size (type to filter)',
        source: async (term?: string) =>
          all.filter((c) => !term || c.name.toLowerCase().includes(term.toLowerCase())),
      });
    } else {
      size = sizePick;
    }
  } else {
    // Live catalog unavailable (offline, bad token, or provider has no catalog e.g. hetzner) -
    // fall back to free-text inputs so init never hard-blocks.
    console.log('Could not load the live size catalog - entering values manually.');
    region = await input({ message: 'Default region', default: provider === 'hetzner' ? 'nbg1' : 'nyc1' });
    size = await input({ message: 'Default server size', default: provider === 'hetzner' ? 'cx22' : 's-2vcpu-4gb' });
  }
  console.log('Connectivity: tailscale = zero public ports, reachable from any device; direct = public IP, key-only SSH.');
  const sshMode = await select({
    message: 'Connectivity mode',
    choices: [
      { value: 'tailscale' as const, name: 'tailscale', description: 'Recommended - no public ports, reach from your phone or laptop via Tailscale' },
      { value: 'direct' as const, name: 'direct', description: 'Escape hatch - public IP with key-only SSH, no Tailscale required' },
    ],
    default: 'tailscale' as const,
  });
  let tailscaleAuthKey: string | undefined;
  if (sshMode === 'tailscale') {
    console.log('Create a Tailscale auth key at: https://login.tailscale.com/admin/settings/keys');
    tailscaleAuthKey = await password({ message: 'Tailscale auth key' });

    // Optional: offer tailscale CLI if missing
    const tailscaleMissing = spawnSync('which', ['tailscale']).status !== 0;
    if (tailscaleMissing) {
      const tsRecheck = (name: string) => spawnSync('which', [name]).status === 0;
      const tsDeps = buildPreflightDeps('', tsRecheck);
      await runPreflight(
        [{ name: 'tailscale', status: 'warn', detail: 'tailscale CLI not found' }],
        tsDeps,
        [],
      );
    }
  }
  console.log('Agents: you can pick both. claude-code is checked by default.');
  const agents = await checkbox({
    message: 'Agents to install',
    choices: AGENT_NAMES.map((a) => ({ value: a, checked: a === 'claude-code' })),
  });
  let claudeOauthToken: string | undefined;
  if (agents.includes('claude-code')) {
    console.log('Optional: pre-authenticate Claude Code. Run `claude setup-token` on THIS machine and paste the token.');
    console.log('(Leave blank to instead log in interactively on the box later. A pasted token is placed in the box\'s cloud-init metadata.)');
    const t = await password({ message: 'Claude setup-token (optional)' });
    claudeOauthToken = t || undefined;
  }
  const sshPublicKeyPath = await input({
    message: 'SSH public key path',
    default: join(homedir(), '.ssh', 'id_ed25519.pub'),
  });

  // SSH key preflight - required, but non-fatal: init saves even if key is absent
  if (!existsSync(sshPublicKeyPath)) {
    const recheck = (name: string) => {
      if (name === 'ssh key') return existsSync(sshPublicKeyPath);
      return spawnSync('which', [name]).status === 0;
    };
    const deps = buildPreflightDeps(sshPublicKeyPath, recheck);
    const stillMissing = await runPreflight(
      [{ name: 'ssh key', status: 'error', detail: `${sshPublicKeyPath} not found` }],
      deps,
      ['ssh key'],
    );
    if (stillMissing.length > 0) {
      const privPath = sshPublicKeyPath.endsWith('.pub')
        ? sshPublicKeyPath.slice(0, -4)
        : sshPublicKeyPath;
      console.log('Warning: SSH public key not found. roostr up will fail without it.');
      console.log(`  Create one with: ssh-keygen -t ed25519 -f ${privPath} -N ""`);
    }
  }

  await persistInit({ provider, token, region, size, sshMode, tailscaleAuthKey, agents, sshPublicKeyPath, claudeOauthToken });
  console.log(`Configured: provider=${provider}  mode=${sshMode}  agents=${agents.join(', ') || 'none'}`);

  const provision = await confirm({ message: 'Provision your first box now?', default: false });
  if (provision) {
    const name = await input({ message: 'Box name', default: 'box-1' });
    const { runUp } = await import('./up.js');
    await runUp({ name });
  } else {
    console.log('Saved. When you are ready: roostr up --name <name>');
    console.log('Hint: run roostr doctor to check your environment before provisioning.');
  }
}
