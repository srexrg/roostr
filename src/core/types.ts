export type ProviderName = 'digitalocean' | 'hetzner';
export type AgentName = 'claude-code' | 'codex';
export type SshMode = 'tailscale' | 'direct';
export type ServerStatus = 'active' | 'incomplete' | 'drifted';

export const PROVIDER_NAMES: ProviderName[] = ['digitalocean', 'hetzner'];
export const AGENT_NAMES: AgentName[] = ['claude-code', 'codex'];

export interface ProviderDefaults {
  region: string;
  size: string;
}

export interface Config {
  defaultProvider: ProviderName;
  providers: Partial<Record<ProviderName, ProviderDefaults>>;
  defaultAgents: AgentName[];
  sshMode: SshMode;
  sshPublicKeyPath: string;
}

export interface ServerRecord {
  name: string;
  provider: ProviderName;
  providerServerId: string;
  region: string;
  size: string;
  sshMode: SshMode;
  tailscaleName: string | null;
  publicIp: string | null;
  agents: AgentName[];
  createdAt: string;
  lastSetupAt: string | null;
  status: ServerStatus;
  snapshotId: string | null;   // reserved for hibernate milestone
  hibernatedAt: string | null; // reserved for hibernate milestone
}

export interface BuildSpec {
  name: string;
  provider: ProviderName;
  region: string;
  size: string;
  agents: AgentName[];
  sshMode: SshMode;
  sshPublicKeyPath: string;
}
