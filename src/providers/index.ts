import type { ProviderName } from '../core/types.js';
import { ProviderError } from '../core/errors.js';
import type { Provider } from './provider.js';
import { DigitalOceanProvider } from './digitalocean.js';

export function getProvider(name: ProviderName, opts: { token: string; fetchImpl?: typeof fetch }): Provider {
  switch (name) {
    case 'digitalocean':
      return new DigitalOceanProvider(opts.token, opts.fetchImpl);
    case 'hetzner':
      throw new ProviderError('hetzner provider not implemented yet', 'use --provider digitalocean');
    default: {
      const _exhaustive: never = name;
      throw new ProviderError(`unknown provider: ${String(_exhaustive)}`);
    }
  }
}
