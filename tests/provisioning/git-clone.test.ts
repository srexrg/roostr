import { describe, it, expect } from 'bun:test';
import { buildCloneSshArgs, cloneOverSsh } from '../../src/provisioning/git-clone.js';
import { ConnectivityError } from '../../src/core/errors.js';

describe('buildCloneSshArgs - public repo (no token)', () => {
  const args = buildCloneSshArgs({
    repo: 'owner/repo',
    user: 'dev',
    host: '1.2.3.4',
    identityFile: '/home/user/.ssh/id_rsa',
  });

  it('contains the clean public clone URL', () => {
    expect(args.join(' ')).toContain('git clone https://github.com/owner/repo ~/repo');
  });

  it('does NOT contain credential.helper', () => {
    expect(args.join(' ')).not.toContain('credential.helper');
  });

  it('does NOT contain $(cat)', () => {
    expect(args.join(' ')).not.toContain('$(cat)');
  });

  it('does NOT contain x-access-token', () => {
    expect(args.join(' ')).not.toContain('x-access-token');
  });
});

describe('buildCloneSshArgs - private repo (with token)', () => {
  const TOKEN = 'ghp_SECRET';
  const args = buildCloneSshArgs({
    repo: 'owner/repo',
    user: 'dev',
    host: '1.2.3.4',
    identityFile: '/home/user/.ssh/id_rsa',
    token: TOKEN,
  });

  it('does NOT contain the token anywhere in the args (security check)', () => {
    const serialized = JSON.stringify(args);
    expect(serialized).not.toContain(TOKEN);
  });

  it('does NOT contain x-access-token:<token>@ in the clone URL', () => {
    expect(args.join(' ')).not.toContain(`x-access-token:${TOKEN}@`);
  });

  it('contains credential.helper', () => {
    expect(args.join(' ')).toContain('credential.helper');
  });

  it('contains $(cat) for reading token from stdin', () => {
    expect(args.join(' ')).toContain('$(cat)');
  });

  it('contains the clean public URL (no token embedded)', () => {
    expect(args.join(' ')).toContain('https://github.com/owner/repo');
  });
});

describe('cloneOverSsh', () => {
  it('passes token only as stdin, not in args', async () => {
    const TOKEN = 'ghp_MYTOKEN';
    let capturedArgs: string[] = [];
    let capturedStdin: string | undefined;
    const fakeRunner = async (args: string[], stdin?: string) => {
      capturedArgs = args;
      capturedStdin = stdin;
      return 0;
    };

    await cloneOverSsh(
      { repo: 'owner/repo', user: 'dev', host: '1.2.3.4', identityFile: '/id', token: TOKEN },
      fakeRunner,
    );

    // token must be in stdin, not in args
    expect(capturedStdin).toBe(TOKEN);
    expect(JSON.stringify(capturedArgs)).not.toContain(TOKEN);
  });

  it('resolves when runner returns 0', async () => {
    const fakeRunner = async (_args: string[], _stdin?: string) => 0;
    await expect(
      cloneOverSsh({ repo: 'owner/repo', user: 'dev', host: '1.2.3.4', identityFile: '/id' }, fakeRunner),
    ).resolves.toBeUndefined();
  });

  it('throws ConnectivityError when runner returns non-zero', async () => {
    const fakeRunner = async (_args: string[], _stdin?: string) => 1;
    await expect(
      cloneOverSsh({ repo: 'owner/repo', user: 'dev', host: '1.2.3.4', identityFile: '/id' }, fakeRunner),
    ).rejects.toBeInstanceOf(ConnectivityError);
  });

  it('does not pass token in args for public repo', async () => {
    let capturedArgs: string[] = [];
    let capturedStdin: string | undefined;
    const fakeRunner = async (args: string[], stdin?: string) => {
      capturedArgs = args;
      capturedStdin = stdin;
      return 0;
    };

    await cloneOverSsh(
      { repo: 'owner/repo', user: 'dev', host: '1.2.3.4', identityFile: '/id' },
      fakeRunner,
    );

    expect(capturedStdin).toBeUndefined();
    expect(JSON.stringify(capturedArgs)).not.toContain('x-access-token');
  });
});
