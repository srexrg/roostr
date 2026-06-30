import { describe, it, expect } from 'bun:test';
import { githubToken, listGithubRepos, parseRepo } from '../../src/util/github.js';
import { ConfigError } from '../../src/core/errors.js';

const ok = (stdout: string) => () => ({ status: 0, stdout });

describe('github util', () => {
  it('githubToken returns the trimmed token', () => {
    expect(githubToken(ok('gho_abc\n'))).toBe('gho_abc');
  });
  it('githubToken returns null on failure', () => {
    expect(githubToken(() => ({ status: 1, stdout: '' }))).toBeNull();
  });
  it('listGithubRepos parses the json', () => {
    const repos = listGithubRepos(ok(JSON.stringify([{ nameWithOwner: 'srexrg/roostr', isPrivate: true }])));
    expect(repos).toEqual([{ nameWithOwner: 'srexrg/roostr', isPrivate: true }]);
  });
  it('listGithubRepos returns [] on bad output', () => {
    expect(listGithubRepos(() => ({ status: 1, stdout: 'nope' }))).toEqual([]);
  });
  it('parseRepo splits owner/name and rejects bad input', () => {
    expect(parseRepo('srexrg/roostr')).toEqual({ owner: 'srexrg', name: 'roostr' });
    expect(() => parseRepo('bad')).toThrow(ConfigError);
  });
});
