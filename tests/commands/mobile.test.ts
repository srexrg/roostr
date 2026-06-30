import { describe, it, expect } from 'bun:test';
import { formatMobileCard } from '../../src/commands/mobile.js';

describe('formatMobileCard', () => {
  const opts = {
    name: 'box-1',
    host: 'box-1.tail12345.ts.net',
    user: 'dev',
  };

  it('contains the host', () => {
    const card = formatMobileCard(opts);
    expect(card).toContain(opts.host);
  });

  it('contains the user', () => {
    const card = formatMobileCard(opts);
    expect(card).toContain(opts.user);
  });

  it('contains the server name in the header', () => {
    const card = formatMobileCard(opts);
    expect(card).toContain(opts.name);
  });

  it('mentions Mosh', () => {
    const card = formatMobileCard(opts);
    expect(card.toLowerCase()).toContain('mosh');
  });
});
