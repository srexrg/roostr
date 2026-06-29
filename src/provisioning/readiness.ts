import type { ProviderServer } from '../providers/provider.js';
import { ConnectivityError } from '../core/errors.js';

export interface ReadinessDeps {
  getServer: (id: string) => Promise<ProviderServer | null>;
  probeTcp: (host: string, port: number) => Promise<boolean>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

export async function waitForReady(
  serverId: string,
  deps: ReadinessDeps,
  opts: { timeoutMs?: number; intervalMs?: number; port?: number; probeHost?: string } = {},
): Promise<ProviderServer> {
  const timeoutMs = opts.timeoutMs ?? 300_000;
  const intervalMs = opts.intervalMs ?? 5_000;
  const port = opts.port ?? 22;
  const start = deps.now();
  let everRunningWithIp = false;

  while (deps.now() - start < timeoutMs) {
    const server = await deps.getServer(serverId);
    if (server && server.state === 'running' && server.publicIp) {
      everRunningWithIp = true;
      const host = opts.probeHost ?? server.publicIp;
      if (await deps.probeTcp(host, port)) return server;
    }
    await deps.sleep(intervalMs);
  }

  if (everRunningWithIp) {
    throw new ConnectivityError(
      `server ${serverId} booted with a public IP but TCP port ${port} (SSH) never opened`,
      'the droplet may still be running cloud-init; retry `roostr up <name>` or check the firewall source IP',
    );
  }
  throw new ConnectivityError(
    `server ${serverId} never became running with a public IP within ${Math.round(timeoutMs / 1000)}s`,
    'check the DigitalOcean dashboard; retry `roostr up <name>` or `roostr destroy <name>`',
  );
}
