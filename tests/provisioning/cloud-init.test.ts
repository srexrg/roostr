import { describe, it, expect } from 'bun:test';
import { buildCloudInit, SENTINEL_PATH } from '../../src/provisioning/cloud-init.js';

const KEY = 'ssh-ed25519 AAAAC3Nza...AAA user@host';

describe('buildCloudInit', () => {
  const out = buildCloudInit({ username: 'dev', sshPublicKey: KEY });

  it('starts with the cloud-config header', () => {
    expect(out.startsWith('#cloud-config')).toBe(true);
  });
  it('creates the user with the authorized key and sudo', () => {
    expect(out).toContain('name: dev');
    expect(out).toContain(KEY);
    expect(out).toContain('sudo: ALL=(ALL) NOPASSWD:ALL');
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
});
