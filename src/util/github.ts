import { spawnSync } from 'node:child_process';
import { ConfigError } from '../core/errors.js';

export type Runner = (cmd: string, args: string[]) => { status: number; stdout: string };

const defaultRun: Runner = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return { status: r.status ?? 1, stdout: r.stdout ?? '' };
};

export function githubToken(run: Runner = defaultRun): string | null {
  try {
    const r = run('gh', ['auth', 'token']);
    if (r.status !== 0) return null;
    const t = r.stdout.trim();
    return t.length ? t : null;
  } catch {
    return null;
  }
}

export function listGithubRepos(run: Runner = defaultRun): { nameWithOwner: string; isPrivate: boolean }[] {
  try {
    const r = run('gh', ['repo', 'list', '--json', 'nameWithOwner,isPrivate', '--limit', '200']);
    if (r.status !== 0) return [];
    const parsed = JSON.parse(r.stdout);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseRepo(s: string): { owner: string; name: string } {
  const m = /^([\w.-]+)\/([\w.-]+)$/.exec(s);
  if (!m) throw new ConfigError(`invalid repo: ${s}`, 'use owner/repo');
  return { owner: m[1], name: m[2] };
}
