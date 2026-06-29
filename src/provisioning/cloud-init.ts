export const SENTINEL_PATH = '/var/lib/roostr/ready';

export function buildCloudInit(input: { username: string; sshPublicKey: string }): string {
  const { username, sshPublicKey } = input;
  return `#cloud-config
disable_root: true
ssh_pwauth: false
users:
  - name: ${username}
    groups: sudo
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    ssh_authorized_keys:
      - ${sshPublicKey}
package_update: true
packages:
  - git
  - curl
  - build-essential
swap:
  filename: /swapfile
  size: auto
  maxsize: 4294967296
runcmd:
  - mkdir -p $(dirname ${SENTINEL_PATH})
  - touch ${SENTINEL_PATH}
`;
}
