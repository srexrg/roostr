import { describe, it, expect } from 'bun:test';
import { PROVIDER_NAMES, AGENT_NAMES } from '../../src/core/types.js';

describe('core types', () => {
  it('enumerates the v1 providers, digitalocean first', () => {
    expect(PROVIDER_NAMES).toEqual(['digitalocean', 'hetzner']);
  });
  it('offers only claude-code for now', () => {
    expect(AGENT_NAMES).toEqual(['claude-code']);
  });
});
