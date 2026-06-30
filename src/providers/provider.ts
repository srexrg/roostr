import { ProviderError } from '../core/errors.js';

export type ServerState = 'provisioning' | 'running' | 'stopped' | 'unknown';

export interface CloudSize {
  slug: string;
  vcpus: number;
  memoryGB: number;
  diskGB: number;
  priceMonthly: number;
  currency: string;
  arch: 'x86' | 'arm' | 'unknown';
  regions: string[];
  description?: string;
  available?: boolean;
}

export interface CloudRegion {
  slug: string;
  name: string;
  available: boolean;
}

export interface ProviderServer {
  id: string;
  state: ServerState;
  publicIp: string | null;
}

export interface CreateServerInput {
  name: string;
  region: string;
  size: string;
  image: string;
  sshKeyIds: string[];
  userData: string;
  tags?: string[];
}

export interface FirewallInput {
  name: string;
  tag: string;                   // target droplets by tag (set at create - no open window)
  sshSourceCidr: string | null;  // null = no inbound rules (Tailscale mode); a CIDR = tcp/22 rule (direct mode)
}

export interface Provider {
  ensureSshKey(name: string, publicKey: string): Promise<string>; // returns provider key id
  ensureTag(name: string): Promise<void>;
  createServer(input: CreateServerInput): Promise<ProviderServer>;
  getServer(id: string): Promise<ProviderServer | null>;
  listServers(): Promise<ProviderServer[]>;
  destroyServer(id: string): Promise<void>;
  ensureFirewall(input: FirewallInput): Promise<string>; // returns firewall id
  destroyFirewall(id: string): Promise<void>;
  listSizes(): Promise<CloudSize[]>;
  listRegions(): Promise<CloudRegion[]>;
}

export class ProviderHttpError extends ProviderError {
  status: number;
  constructor(status: number, message: string, hint?: string) {
    super(message, hint);
    this.status = status;
  }
}
