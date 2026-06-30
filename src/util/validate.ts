import { ConfigError } from '../core/errors.js';

const DNS_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export function validateServerName(name: string): void {
  if (!DNS_LABEL.test(name)) {
    throw new ConfigError(
      `invalid server name: ${JSON.stringify(name)}`,
      'use lowercase letters, digits, and hyphens (1-63 chars, no leading/trailing hyphen)',
    );
  }
}

// Tailscale auth keys look like `tskey-...` / `tskey-auth-...` - letters, digits, hyphens only.
export function validateTailscaleAuthKey(key: string): void {
  if (!/^tskey-[A-Za-z0-9-]+$/.test(key.trim())) {
    throw new ConfigError('that does not look like a Tailscale auth key', 'it should start with tskey-');
  }
}
