import { describe, it, expect, afterEach } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm, stat } from 'node:fs/promises';
import { writeJsonAtomic, readJson } from '../../src/util/atomic.js';

const dir = join(tmpdir(), 'roostr-atomic-test');

afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe('atomic json io', () => {
  it('round-trips a value and creates parent dirs', async () => {
    const p = join(dir, 'nested', 'data.json');
    await writeJsonAtomic(p, { a: 1 });
    expect(await readJson<{ a: number }>(p)).toEqual({ a: 1 });
  });
  it('returns null for a missing file', async () => {
    expect(await readJson(join(dir, 'nope.json'))).toBeNull();
  });
  it('applies the requested file mode', async () => {
    const p = join(dir, 'secret.json');
    await writeJsonAtomic(p, { t: 'x' }, { mode: 0o600 });
    const s = await stat(p);
    expect(s.mode & 0o777).toBe(0o600);
  });
});
