import { describe, it, expect, mock } from 'bun:test';
import { offerRemedy, runPreflight } from '../../src/onboarding/preflight.js';
import type { PreflightDeps } from '../../src/onboarding/preflight.js';
import type { DoctorCheck } from '../../src/commands/doctor.js';

function makeDeps(overrides: Partial<PreflightDeps> = {}): PreflightDeps {
  return {
    platform: 'darwin',
    brewPresent: true,
    sshKeyPath: '~/.ssh/id_ed25519.pub',
    confirmRun: async (_remedy) => false,
    run: (_command) => ({ status: 0 }),
    recheck: (_name) => true,
    log: (_msg) => {},
    ...overrides,
  };
}

const sshKeyErr: DoctorCheck = { name: 'ssh key', status: 'error', detail: 'no ssh key' };
const ghWarn: DoctorCheck = { name: 'gh', status: 'warn', detail: 'not found' };
const providerErr: DoctorCheck = { name: 'provider token', status: 'error', detail: 'no token' };

describe('offerRemedy', () => {
  describe('test 1: ssh-key failing, user confirms, run succeeds, recheck ok => fixed', () => {
    it('returns fixed and calls run with ssh-keygen command', async () => {
      const runMock = mock((_command: string) => ({ status: 0 }));
      const confirmMock = mock(async (_remedy: unknown) => true);
      const logMock = mock((_msg: string) => {});

      const deps = makeDeps({
        platform: 'darwin',
        confirmRun: confirmMock,
        run: runMock,
        recheck: (_name) => true,
        log: logMock,
      });

      const result = await offerRemedy(sshKeyErr, deps);

      expect(result).toBe('fixed');
      expect(runMock).toHaveBeenCalledTimes(1);
      const calledWith = runMock.mock.calls[0][0] as string;
      expect(calledWith).toContain('ssh-keygen');
    });
  });

  describe('test 2: gh failing on darwin + brewPresent + confirm yes + run ok => fixed', () => {
    it('returns fixed and calls run with brew install gh', async () => {
      const runMock = mock((_command: string) => ({ status: 0 }));
      const confirmMock = mock(async (_remedy: unknown) => true);

      const deps = makeDeps({
        platform: 'darwin',
        brewPresent: true,
        confirmRun: confirmMock,
        run: runMock,
        recheck: (_name) => true,
      });

      const result = await offerRemedy(ghWarn, deps);

      expect(result).toBe('fixed');
      expect(runMock).toHaveBeenCalledTimes(1);
      const calledWith = runMock.mock.calls[0][0] as string;
      expect(calledWith).toBe('brew install gh');
    });
  });

  describe('test 3: gh failing, user declines => declined, run NOT called', () => {
    it('returns declined when user says no', async () => {
      const runMock = mock((_command: string) => ({ status: 0 }));
      const confirmMock = mock(async (_remedy: unknown) => false);

      const deps = makeDeps({
        platform: 'darwin',
        brewPresent: true,
        confirmRun: confirmMock,
        run: runMock,
        recheck: (_name) => true,
      });

      const result = await offerRemedy(ghWarn, deps);

      expect(result).toBe('declined');
      expect(runMock).not.toHaveBeenCalled();
    });
  });

  describe('test 4: gh failing on linux (kind manual) => shown, run NOT called, confirmRun NOT called', () => {
    it('never calls run or confirmRun for manual remedies', async () => {
      const runMock = mock((_command: string) => ({ status: 0 }));
      const confirmMock = mock(async (_remedy: unknown) => true);

      const deps = makeDeps({
        platform: 'linux',
        brewPresent: false,
        confirmRun: confirmMock,
        run: runMock,
        recheck: (_name) => true,
      });

      const result = await offerRemedy(ghWarn, deps);

      expect(result).toBe('shown');
      expect(runMock).not.toHaveBeenCalled();
      expect(confirmMock).not.toHaveBeenCalled();
    });
  });

  describe('unknown check name (no remedy) => shown with log', () => {
    it('returns shown when no remedy found', async () => {
      const runMock = mock((_command: string) => ({ status: 0 }));
      const confirmMock = mock(async (_remedy: unknown) => true);
      const logMock = mock((_msg: string) => {});

      const unknownCheck: DoctorCheck = { name: 'unknown-tool', status: 'error', detail: 'missing' };
      const deps = makeDeps({
        confirmRun: confirmMock,
        run: runMock,
        log: logMock,
      });

      const result = await offerRemedy(unknownCheck, deps);

      expect(result).toBe('shown');
      expect(runMock).not.toHaveBeenCalled();
      expect(confirmMock).not.toHaveBeenCalled();
      expect(logMock).toHaveBeenCalled();
    });
  });

  describe('run fails (status != 0) => failed', () => {
    it('returns failed when run exits with non-zero', async () => {
      const runMock = mock((_command: string) => ({ status: 1 }));
      const confirmMock = mock(async (_remedy: unknown) => true);

      const deps = makeDeps({
        platform: 'darwin',
        brewPresent: true,
        confirmRun: confirmMock,
        run: runMock,
        recheck: (_name) => true,
      });

      const result = await offerRemedy(ghWarn, deps);

      expect(result).toBe('failed');
    });
  });

  describe('run succeeds but recheck returns false => failed', () => {
    it('returns failed when recheck still fails after run', async () => {
      const runMock = mock((_command: string) => ({ status: 0 }));
      const confirmMock = mock(async (_remedy: unknown) => true);

      const deps = makeDeps({
        platform: 'darwin',
        brewPresent: true,
        confirmRun: confirmMock,
        run: runMock,
        recheck: (_name) => false,
      });

      const result = await offerRemedy(ghWarn, deps);

      expect(result).toBe('failed');
    });
  });

  describe('brew remedy on darwin but brewPresent=false => shown, no run', () => {
    it('does not auto-run brew when brew is not present', async () => {
      const runMock = mock((_command: string) => ({ status: 0 }));
      const confirmMock = mock(async (_remedy: unknown) => true);

      const deps = makeDeps({
        platform: 'darwin',
        brewPresent: false,
        confirmRun: confirmMock,
        run: runMock,
      });

      const result = await offerRemedy(ghWarn, deps);

      expect(result).toBe('shown');
      expect(runMock).not.toHaveBeenCalled();
      expect(confirmMock).not.toHaveBeenCalled();
    });
  });

  describe('always logs why + command', () => {
    it('logs even when returning shown (manual)', async () => {
      const logMock = mock((_msg: string) => {});

      const deps = makeDeps({
        platform: 'linux',
        brewPresent: false,
        log: logMock,
      });

      await offerRemedy(ghWarn, deps);

      expect(logMock).toHaveBeenCalled();
    });
  });
});

describe('runPreflight', () => {
  describe('test 5a: ssh-key fixed, recheck ok => returns []', () => {
    it('returns empty array when all blockOn checks pass after remediation', async () => {
      let sshFixed = false;

      const deps = makeDeps({
        platform: 'darwin',
        brewPresent: true,
        confirmRun: async (_remedy) => true,
        run: (_command) => {
          sshFixed = true;
          return { status: 0 };
        },
        recheck: (name) => {
          if (name === 'ssh key') return sshFixed;
          return true;
        },
      });

      const checks: DoctorCheck[] = [sshKeyErr, ghWarn];
      const stillFailing = await runPreflight(checks, deps, ['ssh key']);

      expect(stillFailing).toEqual([]);
    });
  });

  describe('test 5b: ssh-key stays failing => returns ["ssh key"]', () => {
    it('returns the names of still-failing required checks', async () => {
      const deps = makeDeps({
        platform: 'darwin',
        brewPresent: true,
        confirmRun: async (_remedy) => true,
        run: (_command) => ({ status: 1 }), // command fails
        recheck: (_name) => false,           // still failing
      });

      const checks: DoctorCheck[] = [sshKeyErr, ghWarn];
      const stillFailing = await runPreflight(checks, deps, ['ssh key']);

      expect(stillFailing).toContain('ssh key');
    });
  });

  describe('skips ok checks', () => {
    it('does not call run for checks that are already ok', async () => {
      const runMock = mock((_command: string) => ({ status: 0 }));

      const okCheck: DoctorCheck = { name: 'gh', status: 'ok', detail: 'found' };
      const deps = makeDeps({
        confirmRun: async (_remedy) => true,
        run: runMock,
        recheck: (_name) => true,
      });

      await runPreflight([okCheck], deps, ['gh']);

      expect(runMock).not.toHaveBeenCalled();
    });
  });

  describe('blockOn names not in failing checks are re-probed at end', () => {
    it('returns name in blockOn that recheck says is still failing even if not in failing checks list', async () => {
      const deps = makeDeps({
        recheck: (_name) => false, // always failing
      });

      // No failing checks, but ssh key is in blockOn and recheck says false
      const stillFailing = await runPreflight([], deps, ['ssh key']);

      // recheck('ssh key') returns false => ssh key still in blockOn result
      expect(stillFailing).toContain('ssh key');
    });
  });
});
