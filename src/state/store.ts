import { mkdir, writeFile } from 'node:fs/promises';
import lockfile from 'proper-lockfile';
import type { ServerRecord } from '../core/types.js';
import { configPath, configRoot } from '../util/paths.js';
import { readJson, writeJsonAtomic } from '../util/atomic.js';

const FILE = 'servers.json';

async function readAll(): Promise<ServerRecord[]> {
  return (await readJson<ServerRecord[]>(configPath(FILE))) ?? [];
}

export async function listServers(): Promise<ServerRecord[]> {
  return readAll();
}

export async function getServerRecord(name: string): Promise<ServerRecord | null> {
  return (await readAll()).find((s) => s.name === name) ?? null;
}

// Ensure the lock target exists before acquiring the lock.
async function ensureFile(): Promise<string> {
  await mkdir(configRoot(), { recursive: true });
  const path = configPath(FILE);
  if ((await readJson<ServerRecord[]>(path)) === null) {
    await writeFile(path, '[]', 'utf8');
  }
  return path;
}

async function mutate(fn: (servers: ServerRecord[]) => ServerRecord[]): Promise<void> {
  const path = await ensureFile();
  const release = await lockfile.lock(path, { retries: { retries: 5, minTimeout: 50 } });
  try {
    const next = fn(await readAll());
    await writeJsonAtomic(path, next);
  } finally {
    await release();
  }
}

export async function upsertServer(record: ServerRecord): Promise<void> {
  await mutate((servers) => [...servers.filter((s) => s.name !== record.name), record]);
}

export async function removeServer(name: string): Promise<void> {
  await mutate((servers) => servers.filter((s) => s.name !== name));
}
