import { describe, it, expect } from 'bun:test';
import { RoostrError, ConfigError, ProviderError } from '../../src/core/errors.js';

describe('typed errors', () => {
  it('ConfigError carries phase and hint', () => {
    const e = new ConfigError('missing token', 'run roostr init');
    expect(e).toBeInstanceOf(RoostrError);
    expect(e.phase).toBe('config');
    expect(e.hint).toBe('run roostr init');
    expect(e.message).toBe('missing token');
  });
  it('ProviderError defaults hint to undefined', () => {
    const e = new ProviderError('quota exceeded');
    expect(e.phase).toBe('provider');
    expect(e.hint).toBeUndefined();
  });
});
