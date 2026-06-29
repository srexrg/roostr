import { describe, it, expect, afterAll } from 'bun:test';
import { createServer, type Server } from 'node:net';
import { probeTcp } from '../../src/util/tcp.js';

let server: Server;
let port = 0;

async function listen(): Promise<number> {
  server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return (server.address() as any).port;
}

afterAll(() => { server?.close(); });

describe('probeTcp', () => {
  it('returns true for an open port', async () => {
    port = await listen();
    expect(await probeTcp('127.0.0.1', port, 1000)).toBe(true);
  });
  it('returns false for a closed port', async () => {
    // port 1 on localhost is not listening
    expect(await probeTcp('127.0.0.1', 1, 500)).toBe(false);
  });
});
