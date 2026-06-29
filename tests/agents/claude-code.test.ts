import { describe, it, expect } from 'bun:test';
import { claudeCodeRecipe } from '../../src/agents/claude-code.js';

describe('claudeCodeRecipe', () => {
  it('installs Claude Code as the box user', () => {
    const f = claudeCodeRecipe.fragment({ username: 'dev' });
    const script = (f.runcmd ?? []).join('\n');
    expect(script).toContain('claude.ai/install.sh');
    expect(script).toContain("su - dev -c");
  });
  it('injects the OAuth token only when provided', () => {
    const withTok = claudeCodeRecipe.fragment({ username: 'dev', oauthToken: 'tok-xyz' });
    expect((withTok.runcmd ?? []).join('\n')).toContain('CLAUDE_CODE_OAUTH_TOKEN=tok-xyz');
    const without = claudeCodeRecipe.fragment({ username: 'dev' });
    expect((without.runcmd ?? []).join('\n')).not.toContain('CLAUDE_CODE_OAUTH_TOKEN');
  });
  it('gives a different first-run hint per auth path', () => {
    expect(claudeCodeRecipe.firstRunHint({ hasToken: true })).toMatch(/run `?claude/i);
    expect(claudeCodeRecipe.firstRunHint({ hasToken: false })).toMatch(/login|copy|paste/i);
  });
});
