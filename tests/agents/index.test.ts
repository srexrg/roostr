import { describe, it, expect } from 'bun:test';
import { getAgentRecipe } from '../../src/agents/index.js';
import { RoostrError } from '../../src/core/errors.js';

describe('getAgentRecipe', () => {
  it('returns the claude-code recipe', () => {
    expect(getAgentRecipe('claude-code').name).toBe('claude-code');
  });
  it('throws for an unsupported agent (codex is type-valid but has no recipe yet)', () => {
    expect(() => getAgentRecipe('codex')).toThrow(RoostrError);
  });
});
