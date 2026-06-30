import type { AgentName, Config, ProviderName, SshMode } from '../core/types.js';
import { saveConfig } from '../state/config.js';
import { setSecret } from '../state/secrets.js';
import { select, input, password, checkbox, confirm } from '@inquirer/prompts';
import { AGENT_NAMES, PROVIDER_NAMES } from '../core/types.js';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readDoctlToken } from '../util/doctl.js';

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
    choices: PROVIDER_NAMES.map((p) => ({ value: p })),
  });
  let token: string;
  if (provider === 'digitalocean') {
    const foundToken = await readDoctlToken();
    if (foundToken !== null) {
      const useFound = await confirm({ message: 'Found a doctl token - use it?', default: true });
      if (useFound) {
        token = foundToken;
      } else {
        token = await password({ message: `${provider} API token` });
      }
    } else {
      token = await password({ message: `${provider} API token` });
    }
  } else {
    token = await password({ message: `${provider} API token` });
  }
  const region = await input({ message: 'Default region', default: provider === 'hetzner' ? 'nbg1' : 'nyc1' });
  const size = await input({ message: 'Default server size', default: provider === 'hetzner' ? 'cx22' : 's-2vcpu-4gb' });
  const sshMode = await select({
    message: 'Connectivity mode',
    choices: [{ value: 'tailscale' as const }, { value: 'direct' as const }],
  });
  let tailscaleAuthKey: string | undefined;
  if (sshMode === 'tailscale') {
    console.log('Create a Tailscale auth key at: https://login.tailscale.com/admin/settings/keys');
    tailscaleAuthKey = await password({ message: 'Tailscale auth key' });
  }
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
  await persistInit({ provider, token, region, size, sshMode, tailscaleAuthKey, agents, sshPublicKeyPath, claudeOauthToken });
  console.log('Saved. Next: roostr up');
}
