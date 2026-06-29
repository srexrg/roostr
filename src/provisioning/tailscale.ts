import type { CloudInitFragment } from '../agents/recipe.js';

export function tailscaleFragment(opts: { authKey: string; hostname: string }): CloudInitFragment {
  return {
    runcmd: [
      'curl -fsSL https://tailscale.com/install.sh | sh',
      `tailscale up --auth-key=${opts.authKey} --hostname=${opts.hostname} --ssh`,
    ],
  };
}
