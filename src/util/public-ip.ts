import { ConnectivityError } from '../core/errors.js';

export async function detectPublicIp(fetchImpl: typeof fetch = fetch): Promise<string> {
  try {
    const res = await fetchImpl('https://api.ipify.org?format=json');
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as { ip?: string };
    if (!data.ip) throw new Error('no ip field');
    return data.ip;
  } catch (err) {
    throw new ConnectivityError('could not determine your public IP', 'check your internet connection, or use Tailscale mode (Plan 3)');
  }
}
