import { describe, it, expect } from 'bun:test';
import { tailscaleFragment } from '../../src/provisioning/tailscale.js';

describe('tailscaleFragment', () => {
  const cmds = tailscaleFragment({ authKey: 'tskey-abc', hostname: 'box-1' }).runcmd ?? [];
  const script = cmds.join('\n');
  it('installs and brings up tailscale without --ssh, with --accept-dns', () => {
    expect(script).toContain('tailscale.com/install.sh');
    expect(script).toContain("--auth-key='tskey-abc'");
    expect(script).toContain("--hostname='box-1'");
    expect(script).toContain('--accept-dns');
    expect(script).not.toContain('--ssh');
  });
  it('installs mosh after tailscale install', () => {
    expect(script).toContain('mosh');
    const tailscaleInstallIdx = cmds.findIndex((c) => c.includes('tailscale.com/install.sh'));
    const moshIdx = cmds.findIndex((c) => c.includes('mosh'));
    expect(moshIdx).toBeGreaterThan(tailscaleInstallIdx);
  });
  it('locks ufw to the tailscale interface AFTER tailscale up, with mosh rule', () => {
    expect(script).toContain('ufw default deny incoming');
    expect(script).toContain('ufw allow in on tailscale0 to any port 22 proto tcp');
    expect(script).toContain('ufw allow in on tailscale0 to any port 60000:61000 proto udp');
    expect(script).toContain('ufw --force enable');
    // ufw enable must come after tailscale up (else lockout)
    const upIdx = cmds.findIndex((c) => c.includes('tailscale up'));
    const ufwEnableIdx = cmds.findIndex((c) => c.includes('ufw --force enable'));
    const ufwAllowIdx = cmds.findIndex((c) => c.includes('tailscale0'));
    expect(upIdx).toBeGreaterThanOrEqual(0);
    expect(ufwEnableIdx).toBeGreaterThan(upIdx);
    expect(ufwAllowIdx).toBeGreaterThanOrEqual(0);
    expect(ufwAllowIdx).toBeLessThan(ufwEnableIdx);
  });
});

describe('tailscaleFragment quoting', () => {
  it('wraps auth-key and hostname in single quotes', () => {
    const cmds = tailscaleFragment({ authKey: 'tskey-auth-abc123', hostname: 'my-box' }).runcmd ?? [];
    const up = cmds.find((c) => c.includes('tailscale up')) ?? '';
    expect(up).toContain("--auth-key='tskey-auth-abc123'");
    expect(up).toContain("--hostname='my-box'");
  });

  it('escapes an embedded single quote in the auth key (defense in depth)', () => {
    // validateTailscaleAuthKey would reject this upstream, but the quoting helper
    // must still produce safe output rather than a broken shell command.
    const cmds = tailscaleFragment({ authKey: "tskey-a'b", hostname: 'box-1' }).runcmd ?? [];
    const up = cmds.find((c) => c.includes('tailscale up')) ?? '';
    // The POSIX single-quote escape sequence: 'tskey-a'\''b'
    expect(up).toContain("'\\''");
    // Extract the auth-key value and verify it contains the escape, not a raw quote
    // A raw unescaped ' inside the outer single-quoted string would break shell parsing.
    // The correct form 'tskey-a'\''b' has no bare ' except at boundaries and in the escape.
    const authKeyMatch = up.match(/--auth-key=(\S+)/);
    expect(authKeyMatch).not.toBeNull();
    // The value must not contain a lone ' that is not part of the '\'' escape sequence
    const authVal = authKeyMatch![1];
    expect(authVal).toBe("'tskey-a'\\''b'");
  });
});
