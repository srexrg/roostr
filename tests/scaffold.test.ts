import { describe, it, expect } from 'bun:test';
import { APP_NAME, VERSION } from '../src/version.js';

describe('scaffold', () => {
  it('exposes the app name and a semver version', () => {
    expect(APP_NAME).toBe('roostr');
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
