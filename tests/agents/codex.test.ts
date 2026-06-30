import { describe, it, expect } from 'bun:test';
import { codexRecipe } from '../../src/agents/codex.js';

describe('codexRecipe', () => {
  it('installs codex as the box user', () => {
    const s = (codexRecipe.fragment({ username: 'dev' }).runcmd ?? []).join('\n');
    expect(s).toContain('chatgpt.com/codex/install.sh');
    expect(s).toContain('su - dev -c');
  });
  it('does not embed any token (auth is manual)', () => {
    const s = (codexRecipe.fragment({ username: 'dev' }).runcmd ?? []).join('\n');
    expect(s).not.toContain('OPENAI_API_KEY');
  });
  it('first-run hint mentions OPENAI_API_KEY', () => {
    expect(codexRecipe.firstRunHint()).toMatch(/OPENAI_API_KEY/);
  });
});
