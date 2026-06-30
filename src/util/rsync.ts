import { spawn } from 'node:child_process';
import { basename } from 'node:path';
import { ConnectivityError } from '../core/errors.js';

export interface SyncOpts { localPath: string; user: string; host: string; identityFile: string }
export type RsyncRunner = (args: string[]) => Promise<number>;

export function buildRsyncArgs(o: SyncOpts): string[] {
  const dir = basename(o.localPath.replace(/\/+$/, ''));
  return [
    '-az',
    '--filter=:- .gitignore',
    '-e', `ssh -i ${o.identityFile} -o StrictHostKeyChecking=accept-new`,
    `${o.localPath}/`,
    `${o.user}@${o.host}:~/${dir}/`,
  ];
}

const defaultRun: RsyncRunner = (args) =>
  new Promise((resolve) => {
    const c = spawn('rsync', args, { stdio: 'inherit' });
    c.on('close', (code) => resolve(code ?? 1));
    c.on('error', () => resolve(1));
  });

export async function syncLocal(o: SyncOpts, run: RsyncRunner = defaultRun): Promise<void> {
  const args = buildRsyncArgs(o);
  const code = await run(args);
  if (code !== 0) {
    throw new ConnectivityError(
      `failed to copy ${o.localPath} to the box`,
      `the box is up; retry manually: rsync ${args.join(' ')}`,
    );
  }
}
