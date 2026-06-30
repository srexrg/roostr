import { describe, it, expect } from 'bun:test';
import { parse } from 'yaml';
import { buildCloudInit, SENTINEL_PATH } from '../../src/provisioning/cloud-init.js';
import { tailscaleFragment } from '../../src/provisioning/tailscale.js';
import { claudeCodeRecipe } from '../../src/agents/claude-code.js';

const KEY = 'ssh-ed25519 AAAAC3Nza...AAA user@host';

describe('buildCloudInit', () => {
  const out = buildCloudInit({ username: 'dev', sshPublicKey: KEY });

  it('starts with the cloud-config header', () => {
    expect(out.startsWith('#cloud-config')).toBe(true);
  });
  it('creates the user with the authorized key', () => {
    expect(out).toContain('name: dev');
    expect(out).toContain(KEY);
  });
  it('does not grant the dev user sudo', () => {
    expect(out).not.toContain('NOPASSWD');
    expect(out).not.toContain('groups: sudo');
  });
  it('hardens ssh (no root, no password auth)', () => {
    expect(out).toContain('disable_root: true');
    expect(out).toContain('ssh_pwauth: false');
  });
  it('configures swap and writes the sentinel last', () => {
    expect(out).toContain('swap:');
    expect(out).toContain(SENTINEL_PATH);
    const sentinelIdx = out.indexOf(SENTINEL_PATH);
    const swapIdx = out.indexOf('swap:');
    expect(sentinelIdx).toBeGreaterThan(swapIdx);
  });
  it('includes tmux in the package list', () => {
    expect(out).toContain('tmux');
  });
  it('writes the roostr profile.d script via write_files', () => {
    expect(out).toContain('/etc/profile.d/roostr.sh');
    expect(out).toContain('"$SSH_TTY"');
    expect(out).toContain('exec tmux new -A -s roostr');
  });
});

describe('buildCloudInit composition', () => {
  it('merges fragment runcmds and keeps the sentinel last', () => {
    const out = buildCloudInit({
      username: 'dev', sshPublicKey: 'ssh-ed25519 AAA k',
      fragments: [
        tailscaleFragment({ authKey: 'tskey-abc', hostname: 'box-1' }),
        claudeCodeRecipe.fragment({ username: 'dev' }),
      ],
    });
    expect(out).toContain("--auth-key='tskey-abc'");     // tailscale (single-quoted)
    expect(out).toContain('claude.ai/install.sh');     // agent
    // sentinel is the final runcmd
    const sentinelIdx = out.lastIndexOf(SENTINEL_PATH);
    const tsIdx = out.indexOf('--auth-key');
    const claudeIdx = out.indexOf('claude.ai/install.sh');
    expect(sentinelIdx).toBeGreaterThan(tsIdx);
    expect(sentinelIdx).toBeGreaterThan(claudeIdx);
  });

  it('safely encodes a multi-line runcmd entry (no YAML break)', () => {
    const out = buildCloudInit({
      username: 'dev', sshPublicKey: 'ssh-ed25519 AAA k',
      fragments: [{ runcmd: ['echo one\necho two'] }],
    });
    // the whole document must still parse as YAML
    expect(() => parse(out.replace(/^#cloud-config\n/, ''))).not.toThrow();
  });
});
