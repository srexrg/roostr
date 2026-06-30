import { describe, it, expect } from 'bun:test';
import { validateSshPublicKey, buildAuthorizeArgs, authorizeKeyOnBox } from '../../src/util/ssh-key.js';
import { ConfigError, ConnectivityError } from '../../src/core/errors.js';

const KEY = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILxyz phone';

describe('ssh-key util', () => {
  it('accepts a valid key', () => {
    expect(() => validateSshPublicKey(KEY)).not.toThrow();
  });
  it('rejects shell-dangerous or malformed keys', () => {
    for (const bad of ['ssh-ed25519 AAAA; rm -rf /', 'ssh-ed25519 AAAA`x`', "ssh-ed25519 AAAA'x", 'not-a-key', 'ssh-ed25519\nAAAA']) {
      expect(() => validateSshPublicKey(bad)).toThrow(ConfigError);
    }
  });
  it('builds the authorize ssh args with accept-new and the key', () => {
    const args = buildAuthorizeArgs({ user: 'dev', host: 'box-1', identityFile: '/k', pubkey: KEY });
    expect(args).toContain('dev@box-1');
    expect(args.join(' ')).toContain('StrictHostKeyChecking=accept-new');
    expect(args.join(' ')).toContain('authorized_keys');
    expect(args.join(' ')).toContain(KEY);
  });
  it('authorizeKeyOnBox throws ConnectivityError on ssh failure', async () => {
    await expect(authorizeKeyOnBox({ user: 'dev', host: 'box-1', identityFile: '/k', pubkey: KEY }, async () => 255))
      .rejects.toBeInstanceOf(ConnectivityError);
  });
});
