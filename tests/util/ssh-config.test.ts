import { describe, it, expect, afterEach } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile, rm } from 'node:fs/promises';
import { upsertSshConfigBlock, removeSshConfigBlock } from '../../src/util/ssh-config.js';

const path = join(tmpdir(), 'roostr-sshconfig-test', 'config');
afterEach(async () => { await rm(join(tmpdir(), 'roostr-sshconfig-test'), { recursive: true, force: true }); });

describe('ssh-config block', () => {
  it('writes a Host block and is idempotent', async () => {
    await upsertSshConfigBlock({ name: 'box-1', host: 'box-1', user: 'dev', path });
    await upsertSshConfigBlock({ name: 'box-1', host: 'box-1', user: 'dev', path }); // again
    const txt = await readFile(path, 'utf8');
    expect(txt.match(/Host box-1/g)?.length).toBe(1); // not duplicated
    expect(txt).toContain('HostName box-1');
    expect(txt).toContain('User dev');
    expect(txt).toContain('# >>> roostr box-1 >>>');
  });
  it('removes the block', async () => {
    await upsertSshConfigBlock({ name: 'box-1', host: 'box-1', user: 'dev', path });
    await removeSshConfigBlock('box-1', path);
    const txt = await readFile(path, 'utf8');
    expect(txt).not.toContain('Host box-1');
  });
  it('remove is a no-op when the file is absent', async () => {
    await expect(removeSshConfigBlock('nope', join(tmpdir(), 'roostr-sshconfig-test', 'absent'))).resolves.toBeUndefined();
  });
});
