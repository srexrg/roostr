import { homedir } from 'node:os';
import { join } from 'node:path';
import { APP_NAME } from '../version.js';

export function configRoot(): string {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, APP_NAME);
}

export function configPath(file: string): string {
  return join(configRoot(), file);
}
