import { describe, it, expect } from 'bun:test';
import { renderQr } from '../../src/util/qr.js';

describe('renderQr', () => {
  it('renders a multi-line QR for an ssh url', async () => {
    const out = await renderQr('ssh://dev@box-1');
    expect(out.split('\n').length).toBeGreaterThan(5);
    expect(out.length).toBeGreaterThan(20);
  });
});
