import { describe, it, expect } from 'bun:test';
import { buildRsyncArgs, syncLocal } from '../../src/util/rsync.js';
import { ConnectivityError } from '../../src/core/errors.js';

describe('rsync', () => {
  it('builds gitignore-aware args with the identity file and basename dest', () => {
    const args = buildRsyncArgs({ localPath: './my-app', user: 'dev', host: 'box-1', identityFile: '/k' });
    expect(args).toContain('-az');
    expect(args).toContain('--filter=:- .gitignore');
    expect(args.join(' ')).toContain('ssh -i /k -o StrictHostKeyChecking=accept-new');
    expect(args).toContain('./my-app/');
    expect(args[args.length - 1]).toBe('dev@box-1:~/my-app/');
  });
  it('syncLocal throws ConnectivityError on rsync failure', async () => {
    await expect(syncLocal(
      { localPath: './my-app', user: 'dev', host: 'box-1', identityFile: '/k' },
      async () => 1,
    )).rejects.toBeInstanceOf(ConnectivityError);
  });
  it('syncLocal resolves on success', async () => {
    await expect(syncLocal(
      { localPath: './my-app', user: 'dev', host: 'box-1', identityFile: '/k' },
      async () => 0,
    )).resolves.toBeUndefined();
  });
});
