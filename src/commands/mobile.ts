import { requireConfig } from '../state/config.js';
import { getServerRecord } from '../state/store.js';
import { resolveSshTarget } from './ssh.js';
import { authorizeKeyOnBox } from '../util/ssh-key.js';
import { upsertSshConfigBlock } from '../util/ssh-config.js';
import { renderQr } from '../util/qr.js';

export async function runMobile(name: string, opts: { key?: string }): Promise<void> {
  const record = await getServerRecord(name);
  if (!record) { console.error(`No server named ${name}. Run: roostr status`); process.exitCode = 1; return; }
  const { user, host } = resolveSshTarget(record);
  if (opts.key) {
    const config = await requireConfig();
    const identityFile = config.sshPublicKeyPath.replace(/\.pub$/, '');
    await authorizeKeyOnBox({ user, host, identityFile, pubkey: opts.key });
    console.log('  authorized your phone key on the box');
  }
  await upsertSshConfigBlock({ name, host, user });
  const qr = await renderQr(`ssh://${user}@${host}`);
  console.log(qr);
  console.log(`  Scan with Termius or Blink (iOS) / Termux (Android) to add this box.`);
  console.log(`  Or from any terminal on your tailnet: ssh ${name}   (added to ~/.ssh/config)`);
  console.log(`  Your phone must be on the same Tailscale tailnet.`);
}
