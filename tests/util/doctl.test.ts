import { describe, it, expect, afterEach } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { readDoctlTokenFrom } from '../../src/util/doctl.js';

const dir = join(tmpdir(), 'roostr-doctl-test');
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe('readDoctlTokenFrom', () => {
  it('reads a single-context access-token', async () => {
    const p = join(dir, 'config.yaml');
    await mkdir(dir, { recursive: true });
    await writeFile(p, 'access-token: dop_v1_abc\n');
    expect(await readDoctlTokenFrom(p)).toBe('dop_v1_abc');
  });
  it('returns null when the file is missing', async () => {
    expect(await readDoctlTokenFrom(join(dir, 'nope.yaml'))).toBeNull();
  });
});
