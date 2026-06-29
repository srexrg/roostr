import type { Config } from '../core/types.js';
import { ConfigError } from '../core/errors.js';
import { configPath } from '../util/paths.js';
import { readJson, writeJsonAtomic } from '../util/atomic.js';

const FILE = 'config.json';

export async function loadConfig(): Promise<Config | null> {
  return readJson<Config>(configPath(FILE));
}

export async function saveConfig(config: Config): Promise<void> {
  await writeJsonAtomic(configPath(FILE), config);
}

export async function requireConfig(): Promise<Config> {
  const cfg = await loadConfig();
  if (!cfg) throw new ConfigError('not configured', 'run roostr init');
  return cfg;
}
