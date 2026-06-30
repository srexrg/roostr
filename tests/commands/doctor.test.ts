import { describe, it, expect } from 'bun:test';
import { runDoctorChecks } from '../../src/commands/doctor.js';

describe('runDoctorChecks', () => {
  it('all green when everything present', () => {
    const checks = runDoctorChecks({ has: () => true, fileExists: () => true, hasToken: true, sshPublicKeyPath: '/k.pub' });
    expect(checks.every((c) => c.status === 'ok')).toBe(true);
  });
  it('missing tools warn, missing key + token error', () => {
    const checks = runDoctorChecks({ has: () => false, fileExists: () => false, hasToken: false, sshPublicKeyPath: '/k.pub' });
    const byName = Object.fromEntries(checks.map((c) => [c.name, c.status]));
    expect(byName['gh']).toBe('warn');
    expect(byName['ssh key']).toBe('error');
    expect(byName['provider token']).toBe('error');
  });
});
