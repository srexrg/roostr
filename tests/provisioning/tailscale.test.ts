import { describe, it, expect } from 'bun:test';
import { tailscaleFragment } from '../../src/provisioning/tailscale.js';

describe('tailscaleFragment', () => {
  it('installs tailscale and brings it up with --auth-key/--hostname/--ssh', () => {
    const script = (tailscaleFragment({ authKey: 'tskey-abc', hostname: 'box-1' }).runcmd ?? []).join('\n');
    expect(script).toContain('tailscale.com/install.sh');
    expect(script).toContain('--auth-key=tskey-abc');
    expect(script).toContain('--hostname=box-1');
    expect(script).toContain('--ssh');
  });
});
