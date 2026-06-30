import { ProviderError } from '../core/errors.js';

export interface OAuthClientCreds {
  clientId: string;
  clientSecret: string;
}

export interface MintOptions {
  tag?: string;
  ttlSeconds?: number;
}

// Use a minimal callable type instead of `typeof fetch` to avoid Bun-specific property mismatches
// while still accepting the global fetch and any test stub.
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const OAUTH_TOKEN_URL = 'https://api.tailscale.com/api/v2/oauth/token';
const CREATE_KEY_URL = 'https://api.tailscale.com/api/v2/tailnet/-/keys';

const DEFAULT_TAG = 'tag:devbox';
const DEFAULT_TTL = 1800;

/**
 * Exchange OAuth client credentials for a short-lived access token.
 * The request uses application/x-www-form-urlencoded body per OAuth 2.0 spec.
 * Throws a clear ProviderError on failure, especially on 401/403 (invalid creds).
 */
export async function getOAuthAccessToken(
  creds: OAuthClientCreds,
  fetchImpl: FetchLike = globalThis.fetch,
): Promise<string> {
  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: 'client_credentials',
  });

  const res = await fetchImpl(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const status = res.status;
    if (status === 401 || status === 403) {
      throw new ProviderError(
        `Tailscale OAuth: invalid credentials (${status} ${res.statusText}). ` +
          'Check your OAuth client ID and secret.',
        'Verify credentials at https://login.tailscale.com/admin/settings/oauth',
      );
    }
    throw new ProviderError(
      `Tailscale OAuth token grant failed: ${status} ${res.statusText}`,
    );
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new ProviderError('Tailscale OAuth: response missing access_token field');
  }
  return data.access_token;
}

/**
 * Full flow: exchange OAuth creds for an access token, then create a single-use
 * tagged auth key. Returns the key string (e.g. "tskey-auth-...").
 */
export async function mintTailscaleAuthKey(
  creds: OAuthClientCreds,
  opts?: MintOptions,
  fetchImpl: FetchLike = globalThis.fetch,
): Promise<string> {
  const tag = opts?.tag ?? DEFAULT_TAG;
  const expirySeconds = opts?.ttlSeconds ?? DEFAULT_TTL;

  const accessToken = await getOAuthAccessToken(creds, fetchImpl);

  const res = await fetchImpl(CREATE_KEY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      capabilities: {
        devices: {
          create: {
            reusable: false,
            ephemeral: false,
            preauthorized: true,
            tags: [tag],
          },
        },
      },
      expirySeconds,
      description: 'roostr',
    }),
  });

  if (!res.ok) {
    const status = res.status;
    if (status === 401 || status === 403) {
      throw new ProviderError(
        `Tailscale create-key: authorization failed (${status} ${res.statusText}). ` +
          'Ensure the OAuth client has the "auth_keys" write scope and owns the "' +
          tag +
          '" tag.',
      );
    }
    throw new ProviderError(
      `Tailscale create-key request failed: ${status} ${res.statusText}`,
    );
  }

  const data = (await res.json()) as { key?: string };
  if (!data.key) {
    throw new ProviderError('Tailscale create-key: response missing key field');
  }
  return data.key;
}

/**
 * Cheap validation: attempt a token grant and return true if it succeeds.
 * Throws with a clear message on 401/403 (invalid creds).
 */
export async function validateOAuthClient(
  creds: OAuthClientCreds,
  fetchImpl: FetchLike = globalThis.fetch,
): Promise<boolean> {
  await getOAuthAccessToken(creds, fetchImpl);
  return true;
}
