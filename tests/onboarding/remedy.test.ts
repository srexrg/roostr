import { describe, it, expect } from 'bun:test';
import { remedyFor, shellSafePath } from '../../src/onboarding/remedy.js';

describe('remedyFor', () => {
  it('returns null for unknown check names', () => {
    expect(remedyFor('unknown-check', 'darwin')).toBeNull();
    expect(remedyFor('', 'linux')).toBeNull();
    expect(remedyFor('foobar', 'other')).toBeNull();
  });

  describe('ssh key', () => {
    it('darwin: kind ssh-keygen, canAutoRun true, command contains ssh-keygen -t ed25519', () => {
      const r = remedyFor('ssh key', 'darwin');
      expect(r).not.toBeNull();
      expect(r!.kind).toBe('ssh-keygen');
      expect(r!.canAutoRun).toBe(true);
      expect(r!.command).toContain('ssh-keygen -t ed25519');
    });

    it('uses private path derived from sshKeyPath (strips .pub)', () => {
      const r = remedyFor('ssh key', 'darwin', { sshKeyPath: '/Users/x/.ssh/id_ed25519.pub' });
      expect(r).not.toBeNull();
      expect(r!.command).toContain('/Users/x/.ssh/id_ed25519');
      expect(r!.command).not.toContain('.pub');
    });

    it('defaults to ~/.ssh/id_ed25519 when no sshKeyPath given', () => {
      const r = remedyFor('ssh key', 'linux');
      expect(r).not.toBeNull();
      expect(r!.command).toContain('~/.ssh/id_ed25519');
      expect(r!.canAutoRun).toBe(true);
    });

    it('single-quotes a key path containing a space or shell metacharacters', () => {
      const r = remedyFor('ssh key', 'darwin', { sshKeyPath: '/Users/x/my keys/id.pub' });
      expect(r!.command).toContain(`'/Users/x/my keys/id'`);

      const evil = remedyFor('ssh key', 'darwin', { sshKeyPath: '/tmp/x"; rm -rf ~ #.pub' });
      // the metacharacters are confined inside single quotes - never bare in the command
      expect(evil!.command).not.toMatch(/-f [^']*; rm/);
      expect(evil!.command).toContain(`'/tmp/x"; rm -rf ~ #'`);
    });
  });

  describe('shellSafePath', () => {
    it('leaves ordinary paths untouched so ~ still expands', () => {
      expect(shellSafePath('~/.ssh/id_ed25519')).toBe('~/.ssh/id_ed25519');
      expect(shellSafePath('/Users/x/.ssh/id_ed25519')).toBe('/Users/x/.ssh/id_ed25519');
    });
    it('quotes paths with spaces or metacharacters', () => {
      expect(shellSafePath('/a b/c')).toBe(`'/a b/c'`);
      expect(shellSafePath("/a'b")).toBe(`'/a'\\''b'`);
    });

    it('linux: kind ssh-keygen, canAutoRun true', () => {
      const r = remedyFor('ssh key', 'linux');
      expect(r).not.toBeNull();
      expect(r!.kind).toBe('ssh-keygen');
      expect(r!.canAutoRun).toBe(true);
    });

    it('other: kind ssh-keygen, canAutoRun true', () => {
      const r = remedyFor('ssh key', 'other');
      expect(r).not.toBeNull();
      expect(r!.kind).toBe('ssh-keygen');
      expect(r!.canAutoRun).toBe(true);
    });
  });

  describe('gh', () => {
    it('darwin: kind brew, canAutoRun true, command brew install gh', () => {
      const r = remedyFor('gh', 'darwin');
      expect(r).not.toBeNull();
      expect(r!.kind).toBe('brew');
      expect(r!.canAutoRun).toBe(true);
      expect(r!.command).toBe('brew install gh');
    });

    it('linux: canAutoRun false, kind manual', () => {
      const r = remedyFor('gh', 'linux');
      expect(r).not.toBeNull();
      expect(r!.canAutoRun).toBe(false);
      expect(r!.kind).toBe('manual');
    });

    it('other: canAutoRun false, kind manual', () => {
      const r = remedyFor('gh', 'other');
      expect(r).not.toBeNull();
      expect(r!.canAutoRun).toBe(false);
      expect(r!.kind).toBe('manual');
    });
  });

  describe('tailscale', () => {
    it('darwin: canAutoRun true, kind brew', () => {
      const r = remedyFor('tailscale', 'darwin');
      expect(r).not.toBeNull();
      expect(r!.canAutoRun).toBe(true);
      expect(r!.kind).toBe('brew');
      expect(r!.command).toBe('brew install --cask tailscale-app');
    });

    it('linux: canAutoRun false, kind manual', () => {
      const r = remedyFor('tailscale', 'linux');
      expect(r).not.toBeNull();
      expect(r!.canAutoRun).toBe(false);
      expect(r!.kind).toBe('manual');
    });
  });

  describe('rsync', () => {
    it('darwin: kind brew, canAutoRun true, command brew install rsync', () => {
      const r = remedyFor('rsync', 'darwin');
      expect(r).not.toBeNull();
      expect(r!.kind).toBe('brew');
      expect(r!.canAutoRun).toBe(true);
      expect(r!.command).toBe('brew install rsync');
    });

    it('linux: kind manual, canAutoRun false', () => {
      const r = remedyFor('rsync', 'linux');
      expect(r).not.toBeNull();
      expect(r!.kind).toBe('manual');
      expect(r!.canAutoRun).toBe(false);
      expect(r!.command).toBe('sudo apt install rsync');
    });
  });

  describe('provider token', () => {
    it('all platforms: kind manual, canAutoRun false, command roostr init', () => {
      for (const platform of ['darwin', 'linux', 'other'] as const) {
        const r = remedyFor('provider token', platform);
        expect(r).not.toBeNull();
        expect(r!.kind).toBe('manual');
        expect(r!.canAutoRun).toBe(false);
        expect(r!.command).toBe('roostr init');
      }
    });
  });

  describe('why fields are set', () => {
    it('gh has why about roostr up --clone', () => {
      const r = remedyFor('gh', 'darwin');
      expect(r!.why).toBeTruthy();
    });

    it('tailscale has why about tailnet', () => {
      const r = remedyFor('tailscale', 'darwin');
      expect(r!.why).toBeTruthy();
    });

    it('ssh key has why about authentication', () => {
      const r = remedyFor('ssh key', 'darwin');
      expect(r!.why).toBeTruthy();
    });

    it('name field matches the check name', () => {
      expect(remedyFor('gh', 'darwin')!.name).toBe('gh');
      expect(remedyFor('tailscale', 'linux')!.name).toBe('tailscale');
      expect(remedyFor('rsync', 'darwin')!.name).toBe('rsync');
      expect(remedyFor('ssh key', 'darwin')!.name).toBe('ssh key');
      expect(remedyFor('provider token', 'darwin')!.name).toBe('provider token');
    });
  });
});
