import { stringify } from 'yaml';
import type { CloudInitFragment } from '../agents/recipe.js';

export const SENTINEL_PATH = '/var/lib/roostr/ready';

export function buildCloudInit(opts: {
  username: string;
  sshPublicKey: string;
  fragments?: CloudInitFragment[];
}): string {
  const { username, sshPublicKey, fragments = [] } = opts;
  const basePackages = ['git', 'curl', 'build-essential'];
  const packages = [...new Set([...basePackages, ...fragments.flatMap((f) => f.packages ?? [])])];
  const runcmd = [
    ...fragments.flatMap((f) => f.runcmd ?? []),
    `mkdir -p $(dirname ${SENTINEL_PATH})`,
    `touch ${SENTINEL_PATH}`,
  ];

  const config = {
    disable_root: true,
    ssh_pwauth: false,
    users: [
      {
        name: username,
        // no sudo: an agent runs arbitrary shell and must not self-escalate
        shell: '/bin/bash',
        ssh_authorized_keys: [sshPublicKey],
      },
    ],
    package_update: true,
    packages,
    swap: { filename: '/swapfile', size: 'auto', maxsize: 4294967296 },
    runcmd,
  };

  return `#cloud-config\n${stringify(config)}`;
}
