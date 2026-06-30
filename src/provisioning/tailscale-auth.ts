import { ConfigError } from '../core/errors.js';

export interface TailscaleAuthDeps {
  getSecret: (key: string) => Promise<string | null>;
  mint: (creds: { clientId: string; clientSecret: string }) => Promise<string>;
}

// Prefer an OAuth client (auto-mint a fresh short-lived key); else a stored static key; else error.
export async function resolveTailscaleAuthKey(deps: TailscaleAuthDeps): Promise<string> {
  const clientId = await deps.getSecret('tailscale-oauth-client-id');
  const clientSecret = await deps.getSecret('tailscale-oauth-client-secret');
  if (clientId && clientSecret) return deps.mint({ clientId, clientSecret });
  const stored = await deps.getSecret('tailscale');
  if (stored) return stored;
  throw new ConfigError('no Tailscale auth key or OAuth client', 'run roostr init and choose tailscale mode');
}
