import { describe, it, expect } from 'bun:test';
import { resolveBuildSpec } from '../../src/commands/up.js';
import { ConfigError } from '../../src/core/errors.js';
import type { Config } from '../../src/core/types.js';

const config: Config = {
  defaultProvider: 'digitalocean',
  providers: { digitalocean: { region: 'nyc1', size: 's-2vcpu-4gb' } },
  defaultAgents: ['claude-code'], sshMode: 'direct', sshPublicKeyPath: '/k.pub',
};

describe('resolveBuildSpec', () => {
  it('uses config defaults when no flags given', () => {
    const spec = resolveBuildSpec(config, { hasToken: true }, { name: 'box-1' });
    expect(spec).toEqual({
      name: 'box-1', provider: 'digitalocean', region: 'nyc1', size: 's-2vcpu-4gb',
      agents: ['claude-code'], sshMode: 'direct', sshPublicKeyPath: '/k.pub',
      project: { kind: 'fresh' },
    });
  });
  it('lets flags override config', () => {
    const spec = resolveBuildSpec(config, { hasToken: true }, { name: 'box-2', region: 'sfo3', size: 's-4vcpu-8gb' });
    expect(spec.region).toBe('sfo3');
    expect(spec.size).toBe('s-4vcpu-8gb');
  });
  it('throws ConfigError when the chosen provider has no token', () => {
    expect(() => resolveBuildSpec(config, { hasToken: false }, { name: 'box-3' })).toThrow(ConfigError);
  });
  it('throws ConfigError for names with shell metacharacters', () => {
    expect(() => resolveBuildSpec(config, { hasToken: true }, { name: 'box;reboot' })).toThrow(ConfigError);
    expect(() => resolveBuildSpec(config, { hasToken: true }, { name: 'box$(x)' })).toThrow(ConfigError);
  });
  it('defaults project to fresh', () => {
    expect(resolveBuildSpec(config, { hasToken: true }, { name: 'box-1' }).project).toEqual({ kind: 'fresh' });
  });
  it('parses --clone owner/repo', () => {
    const s = resolveBuildSpec(config, { hasToken: true }, { name: 'box-1', clone: 'srexrg/roostr' });
    expect(s.project).toEqual({ kind: 'clone', repo: 'srexrg/roostr' });
  });
  it('parses --copy path', () => {
    const s = resolveBuildSpec(config, { hasToken: true }, { name: 'box-1', copy: './app' });
    expect(s.project).toEqual({ kind: 'copy', localPath: './app' });
  });
  it('rejects a bad repo and rejects clone+copy together', () => {
    expect(() => resolveBuildSpec(config, { hasToken: true }, { name: 'box-1', clone: 'not-a-repo' })).toThrow(ConfigError);
    expect(() => resolveBuildSpec(config, { hasToken: true }, { name: 'box-1', clone: 'a/b', copy: './x' })).toThrow(ConfigError);
  });
});
