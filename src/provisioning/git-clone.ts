import { spawn } from 'node:child_process';
import { ConnectivityError } from '../core/errors.js';

export interface CloneOpts {
  repo: string;            // "owner/name"
  user: string;
  host: string;
  identityFile: string;
  token?: string;          // GitHub token for private repos; omit for public
}
export type CloneRunner = (args: string[], stdin?: string) => Promise<number>;

// Build the ssh argv. MUST NEVER contain the token. The clone URL is always the clean public URL.
// When a token is needed, the remote command reads it from stdin into an env var and feeds it to git
// via a command-scoped (`-c`) credential helper, so the token is never in argv, the URL, or .git/config.
export function buildCloneSshArgs(o: CloneOpts): string[] {
  const name = o.repo.split('/')[1];
  const url = `https://github.com/${o.repo}`;
  const dest = `~/${name}`;
  const remote = o.token
    ? `T=$(cat); export T; git -c credential.helper='!f(){ echo username=x-access-token; echo "password=$T"; };f' clone ${url} ${dest}`
    : `git clone ${url} ${dest}`;
  return ['-i', o.identityFile, '-o', 'StrictHostKeyChecking=accept-new', `${o.user}@${o.host}`, remote];
}

const defaultRun: CloneRunner = (args, stdin) =>
  new Promise((resolve) => {
    const c = spawn('ssh', args, { stdio: [stdin === undefined ? 'inherit' : 'pipe', 'inherit', 'inherit'] });
    if (stdin !== undefined) { c.stdin!.write(stdin); c.stdin!.end(); }
    c.on('close', (code) => resolve(code ?? 1));
    c.on('error', () => resolve(1));
  });

export async function cloneOverSsh(o: CloneOpts, run: CloneRunner = defaultRun): Promise<void> {
  const args = buildCloneSshArgs(o);
  const code = await run(args, o.token);   // token (if any) goes ONLY to stdin, never argv
  if (code !== 0) {
    throw new ConnectivityError(
      `failed to clone ${o.repo} onto the box`,
      `the box is up; clone manually after connecting, or check the repo/token`,
    );
  }
}
