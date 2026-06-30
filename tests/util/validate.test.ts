import { describe, it, expect } from 'bun:test';
import { validateServerName, validateTailscaleAuthKey } from '../../src/util/validate.js';
import { ConfigError } from '../../src/core/errors.js';

describe('validateServerName', () => {
  it('accepts a valid DNS label', () => {
    expect(() => validateServerName('box-1')).not.toThrow();
    expect(() => validateServerName('dev')).not.toThrow();
  });
  it('rejects shell metacharacters and spaces', () => {
    for (const bad of ['box 1', 'box;rm', 'box$(x)', "box'\"", 'box`x`', 'box|x']) {
      expect(() => validateServerName(bad)).toThrow(ConfigError);
    }
  });
  it('rejects bad DNS shapes', () => {
    for (const bad of ['-box', 'box-', 'Box', '', 'a'.repeat(64)]) {
      expect(() => validateServerName(bad)).toThrow(ConfigError);
    }
  });
});

describe('validateTailscaleAuthKey', () => {
  it('accepts valid tailscale auth keys', () => {
    expect(() => validateTailscaleAuthKey('tskey-auth-abc123')).not.toThrow();
    expect(() => validateTailscaleAuthKey('tskey-abc123')).not.toThrow();
    expect(() => validateTailscaleAuthKey('tskey-auth-ABCXYZ-abc123')).not.toThrow();
  });
  it('rejects an empty string', () => {
    expect(() => validateTailscaleAuthKey('')).toThrow(ConfigError);
  });
  it('rejects a string that does not start with tskey-', () => {
    expect(() => validateTailscaleAuthKey('notakey')).toThrow(ConfigError);
    expect(() => validateTailscaleAuthKey('authkey-abc')).toThrow(ConfigError);
  });
  it('rejects a key with shell metacharacters (space, semicolon)', () => {
    expect(() => validateTailscaleAuthKey('tskey-abc; rm -rf ~')).toThrow(ConfigError);
    expect(() => validateTailscaleAuthKey('tskey-abc def')).toThrow(ConfigError);
  });
  it('rejects a key with other shell metacharacters', () => {
    expect(() => validateTailscaleAuthKey('tskey-abc$(x)')).toThrow(ConfigError);
    expect(() => validateTailscaleAuthKey("tskey-abc'x")).toThrow(ConfigError);
  });
});
