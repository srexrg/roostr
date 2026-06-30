import type { DoctorCheck } from '../commands/doctor.js';
import { remedyFor, type Platform, type Remedy } from './remedy.js';

export interface PreflightDeps {
  platform: Platform;
  brewPresent: boolean;
  sshKeyPath: string;
  confirmRun: (remedy: Remedy) => Promise<boolean>;
  run: (command: string) => { status: number };
  recheck: (name: string) => boolean;
  log: (msg: string) => void;
}

export type RemedyOutcome = 'fixed' | 'declined' | 'shown' | 'failed';

export async function offerRemedy(check: DoctorCheck, deps: PreflightDeps): Promise<RemedyOutcome> {
  const remedy = remedyFor(check.name, deps.platform, { sshKeyPath: deps.sshKeyPath });

  if (remedy === null) {
    deps.log(`No automated remedy available for: ${check.name} - ${check.detail}`);
    return 'shown';
  }

  // Always log why + command so user can copy-paste
  deps.log(`[${check.name}] ${remedy.why}`);
  deps.log(`  Run: ${remedy.command}`);

  const autoRun = remedy.canAutoRun && (remedy.kind !== 'brew' || deps.brewPresent);

  if (!autoRun) {
    return 'shown';
  }

  const confirmed = await deps.confirmRun(remedy);
  if (!confirmed) {
    return 'declined';
  }

  const { status } = deps.run(remedy.command);
  if (status === 0 && deps.recheck(check.name)) {
    return 'fixed';
  }
  return 'failed';
}

export async function runPreflight(
  checks: DoctorCheck[],
  deps: PreflightDeps,
  blockOn: string[],
): Promise<string[]> {
  for (const check of checks) {
    if (check.status !== 'ok') {
      await offerRemedy(check, deps);
    }
  }
  return blockOn.filter((name) => !deps.recheck(name));
}
