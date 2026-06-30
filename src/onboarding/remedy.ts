export type Platform = 'darwin' | 'linux' | 'other';
export type RemedyKind = 'ssh-keygen' | 'brew' | 'manual';

export interface Remedy {
  name: string;
  why: string;
  command: string;
  kind: RemedyKind;
  canAutoRun: boolean;
}

// Render a filesystem path safe to embed in a `shell: true` command. Paths made
// only of ordinary path characters are left as-is so a leading `~` still expands;
// anything containing a space or shell metacharacter is single-quoted (with embedded
// single quotes escaped) so it can never break out of the command.
export function shellSafePath(p: string): string {
  if (/^[A-Za-z0-9_~./-]+$/.test(p)) return p;
  return `'${p.replace(/'/g, `'\\''`)}'`;
}

export function remedyFor(
  name: string,
  platform: Platform,
  opts?: { sshKeyPath?: string },
): Remedy | null {
  switch (name) {
    case 'ssh key': {
      // Derive the private key path: strip .pub if present, default to ~/.ssh/id_ed25519
      let privPath = opts?.sshKeyPath ?? '~/.ssh/id_ed25519.pub';
      if (privPath.endsWith('.pub')) {
        privPath = privPath.slice(0, -4);
      }
      return {
        name: 'ssh key',
        why: 'needed to authenticate to the box',
        command: `ssh-keygen -t ed25519 -f ${shellSafePath(privPath)} -N ""`,
        kind: 'ssh-keygen',
        canAutoRun: true,
      };
    }

    case 'gh': {
      if (platform === 'darwin') {
        return {
          name: 'gh',
          why: 'needed for roostr up --clone',
          command: 'brew install gh',
          kind: 'brew',
          canAutoRun: true,
        };
      }
      // linux and other
      const ghLinuxCmd =
        platform === 'linux'
          ? '(type -p wget >/dev/null || (sudo apt update && sudo apt install wget -y)) && sudo mkdir -p -m 755 /etc/apt/keyrings && out=$(mktemp) && wget -nv -O$out https://cli.github.com/packages/githubcli-archive-keyring.gpg && cat $out | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null && sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg && sudo mkdir -p -m 755 /etc/apt/sources.list.d && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null && sudo apt update && sudo apt install gh -y'
          : 'See https://cli.github.com for install instructions';
      return {
        name: 'gh',
        why: 'needed for roostr up --clone',
        command: ghLinuxCmd,
        kind: 'manual',
        canAutoRun: false,
      };
    }

    case 'tailscale': {
      if (platform === 'darwin') {
        return {
          name: 'tailscale',
          why: 'needed for tailscale mode and to connect over the tailnet',
          command: 'brew install --cask tailscale-app',
          kind: 'brew',
          canAutoRun: true,
        };
      }
      const tsLinuxCmd =
        platform === 'linux'
          ? 'curl -fsSL https://tailscale.com/install.sh | sh'
          : 'See https://tailscale.com/download for install instructions';
      return {
        name: 'tailscale',
        why: 'needed for tailscale mode and to connect over the tailnet',
        command: tsLinuxCmd,
        kind: 'manual',
        canAutoRun: false,
      };
    }

    case 'rsync': {
      if (platform === 'darwin') {
        return {
          name: 'rsync',
          why: 'needed for roostr up --copy',
          command: 'brew install rsync',
          kind: 'brew',
          canAutoRun: true,
        };
      }
      const rsyncCmd =
        platform === 'linux'
          ? 'sudo apt install rsync'
          : 'See https://rsync.samba.org for install instructions';
      return {
        name: 'rsync',
        why: 'needed for roostr up --copy',
        command: rsyncCmd,
        kind: 'manual',
        canAutoRun: false,
      };
    }

    case 'provider token': {
      return {
        name: 'provider token',
        why: 'needed to call the provider API',
        command: 'roostr init',
        kind: 'manual',
        canAutoRun: false,
      };
    }

    default:
      return null;
  }
}
