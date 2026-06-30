import { describe, it, expect } from 'bun:test';
import {
  getOAuthAccessToken,
  mintTailscaleAuthKey,
  validateOAuthClient,
} from '../../src/provisioning/tailscale-api.js';

const FAKE_CREDS = { clientId: 'test-client-id', clientSecret: 'test-client-secret' };
const FAKE_TOKEN = 'fake-access-token-abc123';
const FAKE_KEY = 'tskey-auth-xyz789';

// Minimal FetchLike type matching what the module accepts
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

// Helper to build a minimal Response-like object
function fakeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('getOAuthAccessToken', () => {
  it('posts to the token endpoint and returns access_token', async () => {
    let capturedUrl: string | undefined;
    let capturedInit: RequestInit | undefined;

    const fakeFetch: FetchLike = async (input, init) => {
      capturedUrl = input.toString();
      capturedInit = init;
      return fakeResponse({ access_token: FAKE_TOKEN, token_type: 'Bearer', expires_in: 3600 });
    };

    const token = await getOAuthAccessToken(FAKE_CREDS, fakeFetch);

    expect(token).toBe(FAKE_TOKEN);
    expect(capturedUrl).toBe('https://api.tailscale.com/api/v2/oauth/token');
    expect(capturedInit?.method).toBe('POST');

    // Body must be form-encoded
    const body = capturedInit?.body;
    expect(typeof body === 'string' || body instanceof URLSearchParams).toBe(true);
    const bodyStr = body?.toString() ?? '';
    expect(bodyStr).toContain('client_id=test-client-id');
    expect(bodyStr).toContain('client_secret=test-client-secret');
    expect(bodyStr).toContain('grant_type=client_credentials');
  });

  it('throws a clear error on 401 invalid credentials', async () => {
    const fakeFetch: FetchLike = async () =>
      fakeResponse({ error: 'invalid_client' }, 401);

    await expect(getOAuthAccessToken(FAKE_CREDS, fakeFetch)).rejects.toThrow(
      /invalid.*cred|401|unauthorized/i,
    );
  });

  it('throws a clear error on 403', async () => {
    const fakeFetch: FetchLike = async () =>
      fakeResponse({ error: 'access_denied' }, 403);

    await expect(getOAuthAccessToken(FAKE_CREDS, fakeFetch)).rejects.toThrow(
      /403|forbidden|access/i,
    );
  });
});

describe('mintTailscaleAuthKey', () => {
  it('chains token grant then create-key, returns the key string', async () => {
    let callCount = 0;
    let keyRequestUrl: string | undefined;
    let keyRequestInit: RequestInit | undefined;

    const fakeFetch: FetchLike = async (input, init) => {
      const url = input.toString();
      callCount++;

      if (url.includes('/oauth/token')) {
        return fakeResponse({ access_token: FAKE_TOKEN, token_type: 'Bearer', expires_in: 3600 });
      }

      if (url.includes('/keys')) {
        keyRequestUrl = url;
        keyRequestInit = init;
        return fakeResponse({ id: 'k1234', key: FAKE_KEY, description: 'roostr' });
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await mintTailscaleAuthKey(FAKE_CREDS, undefined, fakeFetch);

    expect(result).toBe(FAKE_KEY);
    expect(callCount).toBe(2);

    // Create-key request must use Bearer token
    const headers = keyRequestInit?.headers as Record<string, string> | undefined;
    const authHeader = headers?.['Authorization'] ?? headers?.['authorization'];
    expect(authHeader).toBe(`Bearer ${FAKE_TOKEN}`);

    // Confirm URL
    expect(keyRequestUrl).toContain('https://api.tailscale.com/api/v2/tailnet/-/keys');

    // Parse and verify the create-key body
    const keyBody = JSON.parse(keyRequestInit?.body as string);
    const createOpts = keyBody.capabilities?.devices?.create;
    expect(createOpts).toBeDefined();
    expect(createOpts.tags).toContain('tag:devbox');
    expect(createOpts.preauthorized).toBe(true);
    expect(createOpts.reusable).toBe(false);
    expect(createOpts.ephemeral).toBe(false);
    expect(keyBody.expirySeconds).toBe(1800);
  });

  it('reflects custom tag and ttlSeconds in the create-key body', async () => {
    let keyBody: Record<string, unknown> | undefined;

    const fakeFetch: FetchLike = async (input, init) => {
      const url = input.toString();
      if (url.includes('/oauth/token')) {
        return fakeResponse({ access_token: FAKE_TOKEN, token_type: 'Bearer', expires_in: 3600 });
      }
      keyBody = JSON.parse(init?.body as string);
      return fakeResponse({ id: 'k5678', key: 'tskey-auth-custom' });
    };

    const result = await mintTailscaleAuthKey(
      FAKE_CREDS,
      { tag: 'tag:foo', ttlSeconds: 600 },
      fakeFetch,
    );

    expect(result).toBe('tskey-auth-custom');
    type Caps = { devices: { create: { tags: string[] } } };
    const createOpts = (keyBody?.capabilities as Caps | undefined)?.devices?.create;
    expect(createOpts?.tags).toContain('tag:foo');
    expect(keyBody?.expirySeconds).toBe(600);
  });

  it('propagates token-grant failure', async () => {
    const fakeFetch: FetchLike = async () =>
      fakeResponse({ error: 'invalid_client' }, 401);

    await expect(
      mintTailscaleAuthKey(FAKE_CREDS, undefined, fakeFetch),
    ).rejects.toThrow();
  });
});

describe('validateOAuthClient', () => {
  it('returns true when token grant succeeds', async () => {
    const fakeFetch: FetchLike = async () =>
      fakeResponse({ access_token: FAKE_TOKEN, token_type: 'Bearer', expires_in: 3600 });

    const result = await validateOAuthClient(FAKE_CREDS, fakeFetch);
    expect(result).toBe(true);
  });

  it('throws or returns false on 401', async () => {
    const fakeFetch: FetchLike = async () =>
      fakeResponse({ error: 'invalid_client' }, 401);

    // Should either throw or return false - both are acceptable
    let threw = false;
    let result: boolean | undefined;
    try {
      result = await validateOAuthClient(FAKE_CREDS, fakeFetch);
    } catch {
      threw = true;
    }
    expect(threw || result === false).toBe(true);
  });
});
