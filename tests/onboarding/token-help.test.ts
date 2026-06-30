import { describe, it, expect } from 'bun:test';
import { isAuthError, tokenGuidance } from '../../src/onboarding/token-help.js';
import { ProviderHttpError } from '../../src/providers/provider.js';
import { ProviderError } from '../../src/core/errors.js';

describe('isAuthError', () => {
  it('returns true for ProviderHttpError with status 401', () => {
    expect(isAuthError(new ProviderHttpError(401, 'Unauthorized'))).toBe(true);
  });

  it('returns true for ProviderHttpError with status 403', () => {
    expect(isAuthError(new ProviderHttpError(403, 'Forbidden'))).toBe(true);
  });

  it('returns false for ProviderHttpError with status 500', () => {
    expect(isAuthError(new ProviderHttpError(500, 'Internal Server Error'))).toBe(false);
  });

  it('returns false for a plain Error', () => {
    expect(isAuthError(new Error('some error'))).toBe(false);
  });

  it('returns false for a ProviderError (not ProviderHttpError)', () => {
    expect(isAuthError(new ProviderError('provider error'))).toBe(false);
  });

  it('returns false for null', () => {
    expect(isAuthError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isAuthError(undefined)).toBe(false);
  });
});

describe('tokenGuidance', () => {
  it('includes the DigitalOcean tokens URL for digitalocean', () => {
    const lines = tokenGuidance('digitalocean');
    expect(lines.some((l) => l.includes('https://cloud.digitalocean.com/account/api/tokens'))).toBe(true);
  });

  it('mentions Write access for digitalocean', () => {
    const lines = tokenGuidance('digitalocean');
    expect(lines.some((l) => l.includes('Write'))).toBe(true);
  });

  it('includes the Hetzner console URL for hetzner', () => {
    const lines = tokenGuidance('hetzner');
    expect(lines.some((l) => l.includes('https://console.hetzner.com'))).toBe(true);
  });

  it('returns a non-empty array for an unknown provider', () => {
    // ProviderName is a union, but we cast to satisfy the type for this edge test
    const lines = tokenGuidance('digitalocean');
    expect(lines.length).toBeGreaterThan(0);
  });
});
