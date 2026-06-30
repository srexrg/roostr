import { describe, it, expect } from 'bun:test';
import { cloneFragment } from '../../src/provisioning/git-clone.js';

describe('cloneFragment', () => {
  it('clones a public repo without a token', () => {
    const s = (cloneFragment({ repo: 'srexrg/roostr', username: 'dev' }).runcmd ?? []).join('\n');
    expect(s).toContain('git clone https://github.com/srexrg/roostr');
    expect(s).toContain('su - dev -c');
    expect(s).not.toContain('x-access-token');
  });
  it('uses the token for a private repo and strips it from the remote', () => {
    const s = (cloneFragment({ repo: 'srexrg/roostr', username: 'dev', githubToken: 'gho_x' }).runcmd ?? []).join('\n');
    expect(s).toContain('https://x-access-token:gho_x@github.com/srexrg/roostr');
    expect(s).toContain('remote set-url origin https://github.com/srexrg/roostr');
  });
});
