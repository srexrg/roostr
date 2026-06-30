import { describe, it, expect } from 'bun:test';
import { validateServerName } from '../../src/util/validate.js';
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
