import type { CloudInitFragment } from '../agents/recipe.js';

export function tailscaleFragment(opts: { authKey: string; hostname: string }): CloudInitFragment {
  return {
    runcmd: [
      'curl -fsSL https://tailscale.com/install.sh | sh',
      `tailscale up --auth-key=${opts.authKey} --hostname=${opts.hostname} --accept-dns`,
      'DEBIAN_FRONTEND=noninteractive apt-get install -y mosh',
      // Only after tailscale0 exists: lock the box to the tailnet (key-only OpenSSH over the tunnel).
      'ufw default deny incoming',
      'ufw default allow outgoing',
      'ufw allow in on tailscale0 to any port 22 proto tcp',
      'ufw allow in on tailscale0 to any port 60000:61000 proto udp',
      'ufw --force enable',
    ],
  };
}
