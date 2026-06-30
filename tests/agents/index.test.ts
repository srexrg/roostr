import { describe, it, expect } from 'bun:test';
import { getAgentRecipe } from '../../src/agents/index.js';

describe('getAgentRecipe', () => {
  it('returns the claude-code recipe', () => {
    expect(getAgentRecipe('claude-code').name).toBe('claude-code');
  });
  it('returns the codex recipe', () => {
    expect(getAgentRecipe('codex').name).toBe('codex');
  });
});
