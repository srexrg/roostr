import { describe, it, expect } from 'bun:test';
import { claudeCodeRecipe } from '../../src/agents/claude-code.js';

describe('claudeCodeRecipe', () => {
  it('installs Claude Code as the box user', () => {
    const f = claudeCodeRecipe.fragment({ username: 'dev' });
    const script = (f.runcmd ?? []).join('\n');
    expect(script).toContain('claude.ai/install.sh');
    expect(script).toContain("su - dev -c");
  });
  it('does not embed any token in the fragment', () => {
    const f = claudeCodeRecipe.fragment({ username: 'dev' });
    expect((f.runcmd ?? []).join('\n')).not.toContain('CLAUDE_CODE_OAUTH_TOKEN');
  });
  it('first-run hint instructs interactive login', () => {
    expect(claudeCodeRecipe.firstRunHint()).toMatch(/login|copy|paste/i);
  });
});
