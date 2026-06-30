import { ProviderHttpError } from '../providers/provider.js';
import type { ProviderName } from '../core/types.js';

export function isAuthError(err: unknown): boolean {
  return err instanceof ProviderHttpError && (err.status === 401 || err.status === 403);
}

export function tokenGuidance(provider: ProviderName): string[] {
  if (provider === 'digitalocean') return [
    'Create a DigitalOcean API token with Write (full access) scope:',
    '  https://cloud.digitalocean.com/account/api/tokens',
  ];
  if (provider === 'hetzner') return [
    'Create a Hetzner Cloud API token (Read & Write) inside your project:',
    '  https://console.hetzner.com  (Security -> API tokens -> Generate)',
  ];
  return [`Paste your ${provider} API token.`];
}
