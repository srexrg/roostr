import { spawn } from 'node:child_process';
import { ConfigError, ConnectivityError } from '../core/errors.js';

const KEY_RE = /^(ssh-(rsa|ed25519|dss)|ecdsa-sha2-[a-z0-9-]+|sk-[a-z0-9@.-]+) [A-Za-z0-9+/=]+( [^\n'"`$;|&]*)?$/;

export function validateSshPublicKey(key: string): void {
  if (/[\n\r'"`$;|&]/.test(key) || !KEY_RE.test(key.trim())) {
    throw new ConfigError('invalid SSH public key', 'paste a single-line public key (e.g. ~/.ssh/id_ed25519.pub)');
  }
}

export function buildAuthorizeArgs(opts: { user: string; host: string; identityFile: string; pubkey: string }): string[] {
  const remote = `umask 077; mkdir -p ~/.ssh; printf '%s\\n' '${opts.pubkey}' >> ~/.ssh/authorized_keys`;
  return ['-i', opts.identityFile, '-o', 'StrictHostKeyChecking=accept-new', `${opts.user}@${opts.host}`, remote];
}

export type SshRunner = (args: string[]) => Promise<number>;

const defaultRun: SshRunner = (args) =>
  new Promise((resolve) => {
    const c = spawn('ssh', args, { stdio: 'inherit' });
    c.on('close', (code) => resolve(code ?? 1));
    c.on('error', () => resolve(1));
  });

export async function authorizeKeyOnBox(
  opts: { user: string; host: string; identityFile: string; pubkey: string },
  run: SshRunner = defaultRun,
): Promise<void> {
  validateSshPublicKey(opts.pubkey);
  const code = await run(buildAuthorizeArgs(opts));
  if (code !== 0) throw new ConnectivityError('could not authorize the key on the box', 'check the box is reachable over your tailnet');
}
