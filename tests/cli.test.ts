import { describe, it, expect } from 'bun:test';
import { buildProgram } from '../src/cli.js';

describe('cli program', () => {
  it('reports its version', () => {
    expect(buildProgram().version()).toBe('0.2.0');
  });
  it('registers the init command', () => {
    const names = buildProgram().commands.map((c) => c.name());
    expect(names).toContain('init');
  });
});
