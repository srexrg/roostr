import { describe, it, expect, mock } from 'bun:test';
import { resolveTailscaleAuthKey } from '../../src/provisioning/tailscale-auth.js';
import { ConfigError } from '../../src/core/errors.js';

describe('resolveTailscaleAuthKey', () => {
  it('uses OAuth creds to mint a fresh key when both client-id and client-secret are present', async () => {
    const mintFn = mock(async (_creds: { clientId: string; clientSecret: string }) => 'tskey-auth-minted');
    const getSecret = mock(async (key: string) => {
      if (key === 'tailscale-oauth-client-id') return 'my-client-id';
      if (key === 'tailscale-oauth-client-secret') return 'my-client-secret';
      return null;
    });

    const result = await resolveTailscaleAuthKey({ getSecret, mint: mintFn });

    expect(result).toBe('tskey-auth-minted');
    expect(mintFn).toHaveBeenCalledTimes(1);
    expect(mintFn).toHaveBeenCalledWith({ clientId: 'my-client-id', clientSecret: 'my-client-secret' });
    // Static 'tailscale' key should NOT have been consulted
    const calls = (getSecret as ReturnType<typeof mock>).mock.calls.map((c: unknown[]) => c[0]);
    expect(calls).not.toContain('tailscale');
  });

  it('returns the static tailscale key when no OAuth creds are present', async () => {
    const mintFn = mock(async (_creds: { clientId: string; clientSecret: string }) => 'should-not-be-called');
    const getSecret = mock(async (key: string) => {
      if (key === 'tailscale') return 'tskey-auth-static';
      return null;
    });

    const result = await resolveTailscaleAuthKey({ getSecret, mint: mintFn });

    expect(result).toBe('tskey-auth-static');
    expect(mintFn).toHaveBeenCalledTimes(0);
  });

  it('throws ConfigError when neither OAuth creds nor a static key are present', async () => {
    const mintFn = mock(async (_creds: { clientId: string; clientSecret: string }) => 'should-not-be-called');
    const getSecret = mock(async (_key: string) => null);

    await expect(resolveTailscaleAuthKey({ getSecret, mint: mintFn })).rejects.toBeInstanceOf(ConfigError);
    expect(mintFn).toHaveBeenCalledTimes(0);
  });

  it('falls back to static key (or throws) when only one OAuth secret is present', async () => {
    const mintFn = mock(async (_creds: { clientId: string; clientSecret: string }) => 'should-not-be-called');

    // Only id present, no secret, no static key - should throw
    const getSecretIdOnly = mock(async (key: string) => {
      if (key === 'tailscale-oauth-client-id') return 'my-client-id';
      return null;
    });

    await expect(
      resolveTailscaleAuthKey({ getSecret: getSecretIdOnly, mint: mintFn }),
    ).rejects.toBeInstanceOf(ConfigError);
    expect(mintFn).toHaveBeenCalledTimes(0);

    // Only id present, no secret, but static key exists - should return static key
    const getSecretIdOnlyWithStatic = mock(async (key: string) => {
      if (key === 'tailscale-oauth-client-id') return 'my-client-id';
      if (key === 'tailscale') return 'tskey-auth-static';
      return null;
    });

    const result = await resolveTailscaleAuthKey({ getSecret: getSecretIdOnlyWithStatic, mint: mintFn });
    expect(result).toBe('tskey-auth-static');
    expect(mintFn).toHaveBeenCalledTimes(0);
  });
});
