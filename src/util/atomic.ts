import { mkdir, writeFile, rename, readFile, chmod } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function writeJsonAtomic(
  path: string,
  value: unknown,
  opts: { mode?: number } = {},
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  await writeFile(tmp, JSON.stringify(value, null, 2), opts.mode !== undefined ? { encoding: 'utf8', mode: opts.mode } : 'utf8');
  if (opts.mode !== undefined) await chmod(tmp, opts.mode);
  await rename(tmp, path);
}

export async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}
