import type { CloudInitFragment } from '../agents/recipe.js';

export const SENTINEL_PATH = '/var/lib/roostr/ready';

export function buildCloudInit(opts: {
  username: string;
  sshPublicKey: string;
  fragments?: CloudInitFragment[];
}): string {
  const { username, sshPublicKey, fragments = [] } = opts;
  const basePackages = ['git', 'curl', 'build-essential'];
  const fragPackages = fragments.flatMap((f) => f.packages ?? []);
  const packages = [...new Set([...basePackages, ...fragPackages])];

  const fragRuncmd = fragments.flatMap((f) => f.runcmd ?? []);
  const runcmd = [
    ...fragRuncmd,
    `mkdir -p $(dirname ${SENTINEL_PATH})`,
    `touch ${SENTINEL_PATH}`,
  ];

  const lines: string[] = [
    '#cloud-config',
    'disable_root: true',
    'ssh_pwauth: false',
    'users:',
    `  - name: ${username}`,
    '    groups: sudo',
    '    sudo: ALL=(ALL) NOPASSWD:ALL',
    '    shell: /bin/bash',
    '    ssh_authorized_keys:',
    `      - ${sshPublicKey}`,
    'package_update: true',
    'packages:',
    ...packages.map((p) => `  - ${p}`),
    'swap:',
    '  filename: /swapfile',
    '  size: auto',
    '  maxsize: 4294967296',
    'runcmd:',
    ...runcmd.map((c) => `  - ${c}`),
  ];
  return lines.join('\n') + '\n';
}
