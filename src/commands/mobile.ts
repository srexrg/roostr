import { requireConfig } from '../state/config.js';
import { getServerRecord } from '../state/store.js';
import { resolveSshTarget } from './ssh.js';
import { authorizeKeyOnBox } from '../util/ssh-key.js';
import { upsertSshConfigBlock } from '../util/ssh-config.js';
import { renderQr } from '../util/qr.js';
import { fetchSshIdKeys } from '../util/sshid.js';

export interface MobileCardOptions {
  name: string;
  host: string;
  user: string;
}

export function formatMobileCard(o: MobileCardOptions): string {
  const lines: string[] = [
    `Connect from your phone - ${o.name}`,
    `  Host     ${o.host}        (Tailscale MagicDNS)`,
    `  User     ${o.user}`,
    `  Mosh     enabled (survives Wi-Fi/cellular changes)`,
    `  Startup  just connect - the box auto-attaches tmux  (or set: tmux new -A -s roostr)`,
  ];
  return lines.join('\n');
}

export async function runMobile(name: string, opts: { key?: string; sshid?: string }): Promise<void> {
  const record = await getServerRecord(name);
  if (!record) { console.error(`No server named ${name}. Run: roostr status`); process.exitCode = 1; return; }
  const { user, host } = resolveSshTarget(record);

  if (opts.key) {
    const config = await requireConfig();
    const identityFile = config.sshPublicKeyPath.replace(/\.pub$/, '');
    await authorizeKeyOnBox({ user, host, identityFile, pubkey: opts.key });
    console.log('  authorized your phone key on the box');
  }

  if (opts.sshid) {
    const config = await requireConfig();
    const identityFile = config.sshPublicKeyPath.replace(/\.pub$/, '');
    const keys = await fetchSshIdKeys(opts.sshid);
    for (const key of keys) {
      await authorizeKeyOnBox({ user, host, identityFile, pubkey: key });
    }
    const handle = opts.sshid.trim().replace(/^@/, '').trim();
    console.log(`  authorized ${keys.length} key(s) from @${handle}`);
  }

  await upsertSshConfigBlock({ name, host, user });

  const sshUrl = `ssh://${user}@${host}`;
  const card = formatMobileCard({ name, host, user });
  const qr = await renderQr(sshUrl);

  console.log(card);
  console.log(qr);
  console.log(`    ${sshUrl}`);
  console.log(`    Scan in Termius or Blink (iOS) / Termux (Android). Phone must be on the same Tailscale tailnet.`);
  console.log(`    From this machine: ssh ${name}   (added to ~/.ssh/config)`);
}
