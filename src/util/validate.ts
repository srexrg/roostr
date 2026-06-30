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
