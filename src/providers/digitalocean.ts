import {
  type Provider, type ProviderServer, type ServerState,
  type CreateServerInput, type FirewallInput, ProviderHttpError,
} from './provider.js';

const BASE = 'https://api.digitalocean.com/v2';

interface DropletV4 { ip_address: string; type: string }
interface Droplet { id: number; status: string; networks?: { v4?: DropletV4[] } }
interface SshKey { id: number; fingerprint: string; public_key: string; name: string }

function mapState(status: string): ServerState {
  switch (status) {
    case 'new': return 'provisioning';
    case 'active': return 'running';
    case 'off': return 'stopped';
    default: return 'unknown';
  }
}

function publicIpOf(d: Droplet): string | null {
  return d.networks?.v4?.find((n) => n.type === 'public')?.ip_address ?? null;
}

function hintFor(status: number): string | undefined {
  if (status === 401) return 'check your DigitalOcean token (roostr init)';
  if (status === 429) return 'DigitalOcean rate limit hit; retry shortly';
  return undefined;
}

export class DigitalOceanProvider implements Provider {
  constructor(private token: string, private fetchImpl: typeof fetch = fetch) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      const message = (data && (data as any).message) || res.statusText;
      throw new ProviderHttpError(res.status, `DigitalOcean ${method} ${path} failed (${res.status}): ${message}`, hintFor(res.status));
    }
    return data as T;
  }

  private toServer(d: Droplet): ProviderServer {
    return { id: String(d.id), state: mapState(d.status), publicIp: publicIpOf(d) };
  }

  async createServer(input: CreateServerInput): Promise<ProviderServer> {
    const body = {
      name: input.name,
      region: input.region,
      size: input.size,
      image: input.image,
      ssh_keys: input.sshKeyIds.map((k) => (/^\d+$/.test(k) ? Number(k) : k)),
      user_data: input.userData,
    };
    const data = await this.request<{ droplet: Droplet }>('POST', '/droplets', body);
    return this.toServer(data.droplet);
  }

  async getServer(id: string): Promise<ProviderServer | null> {
    try {
      const data = await this.request<{ droplet: Droplet }>('GET', `/droplets/${id}`);
      return this.toServer(data.droplet);
    } catch (err) {
      if (err instanceof ProviderHttpError && err.status === 404) return null;
      throw err;
    }
  }

  async listServers(): Promise<ProviderServer[]> {
    const data = await this.request<{ droplets: Droplet[] }>('GET', '/droplets?per_page=200');
    return (data.droplets ?? []).map((d) => this.toServer(d));
  }

  async destroyServer(id: string): Promise<void> {
    await this.request<void>('DELETE', `/droplets/${id}`);
  }

  // ensureSshKey + ensureFirewall implemented in Tasks 2 and 3.
  async ensureSshKey(name: string, publicKey: string): Promise<string> {
    const target = publicKey.trim();
    const data = await this.request<{ ssh_keys: SshKey[] }>('GET', '/account/keys?per_page=200');
    const found = (data.ssh_keys ?? []).find((k) => k.public_key.trim() === target);
    if (found) return String(found.id);
    const created = await this.request<{ ssh_key: SshKey }>('POST', '/account/keys', { name, public_key: publicKey });
    return String(created.ssh_key.id);
  }
  async ensureFirewall(input: FirewallInput): Promise<string> {
    const anywhere = { addresses: ['0.0.0.0/0', '::/0'] };
    const inbound_rules = input.sshSourceCidr
      ? [{ protocol: 'tcp', ports: '22', sources: { addresses: [input.sshSourceCidr] } }]
      : [];
    const body = {
      name: input.name,
      droplet_ids: [Number(input.serverId)],
      inbound_rules,
      outbound_rules: [
        { protocol: 'tcp', ports: 'all', destinations: anywhere },
        { protocol: 'udp', ports: 'all', destinations: anywhere },
        { protocol: 'icmp', ports: '0', destinations: anywhere },
      ],
    };
    const data = await this.request<{ firewall: { id: string } }>('POST', '/firewalls', body);
    return data.firewall.id;
  }

  async destroyFirewall(id: string): Promise<void> {
    await this.request<void>('DELETE', `/firewalls/${id}`);
  }
}

export { ProviderHttpError } from './provider.js';
