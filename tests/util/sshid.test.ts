import { describe, it, expect } from 'bun:test';
import { validateSshIdHandle, fetchSshIdKeys, type FetchLike } from '../../src/util/sshid.js';

const KEY1 = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILxyz phone1';
const KEY2 = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC phone2';

const VALID_BODY = `# my keys
${KEY1}
${KEY2}

# another comment
`;

function fakeFetch(status: number, body: string): FetchLike {
  return async (_url: string, _init?: RequestInit) => {
    return new Response(body, { status });
  };
}

describe('validateSshIdHandle', () => {
  it('accepts simple alphanumeric handles', () => {
    expect(validateSshIdHandle('alice')).toBe(true);
    expect(validateSshIdHandle('alice123')).toBe(true);
    expect(validateSshIdHandle('Alice_Bob')).toBe(true);
    expect(validateSshIdHandle('my.handle')).toBe(true);
    expect(validateSshIdHandle('my-handle')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateSshIdHandle('')).toBe(false);
  });

  it('rejects handles with spaces or special chars', () => {
    expect(validateSshIdHandle('alice bob')).toBe(false);
    expect(validateSshIdHandle('alice/bob')).toBe(false);
    expect(validateSshIdHandle('alice@bob')).toBe(false);
    expect(validateSshIdHandle('<script>')).toBe(false);
  });
});

describe('fetchSshIdKeys', () => {
  it('returns an array of key lines from a valid authorized_keys body', async () => {
    const keys = await fetchSshIdKeys('alice', fakeFetch(200, VALID_BODY));
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(KEY1);
    expect(keys[1]).toBe(KEY2);
  });

  it('strips a leading @ from the handle', async () => {
    // Should not throw - the @ gets stripped
    const keys = await fetchSshIdKeys('@alice', fakeFetch(200, VALID_BODY));
    expect(keys).toHaveLength(2);
  });

  it('strips leading whitespace from the handle', async () => {
    const keys = await fetchSshIdKeys('  alice  ', fakeFetch(200, VALID_BODY));
    expect(keys).toHaveLength(2);
  });

  it('throws a clear error for a non-200 response', async () => {
    await expect(fetchSshIdKeys('alice', fakeFetch(404, 'Not Found'))).rejects.toThrow(/404/);
  });

  it('throws a clear error when the body looks like HTML', async () => {
    const html = '<!DOCTYPE html><html><body>Login page</body></html>';
    await expect(fetchSshIdKeys('alice', fakeFetch(200, html))).rejects.toThrow(/@alice/);
  });

  it('throws a clear error when the body has no keys', async () => {
    const body = '# just a comment\n\n   \n';
    await expect(fetchSshIdKeys('alice', fakeFetch(200, body))).rejects.toThrow(/@alice/);
  });

  it('throws a clear error when the body is empty', async () => {
    await expect(fetchSshIdKeys('alice', fakeFetch(200, ''))).rejects.toThrow(/@alice/);
  });

  it('throws for an invalid handle (after stripping @)', async () => {
    await expect(fetchSshIdKeys('bad handle', fakeFetch(200, VALID_BODY))).rejects.toThrow();
    await expect(fetchSshIdKeys('', fakeFetch(200, VALID_BODY))).rejects.toThrow();
    await expect(fetchSshIdKeys('@', fakeFetch(200, VALID_BODY))).rejects.toThrow();
  });

  it('drops blank lines and comments, keeps key lines', async () => {
    const body = `# comment\n\n${KEY1}\n\n# another\n${KEY2}\n`;
    const keys = await fetchSshIdKeys('alice', fakeFetch(200, body));
    expect(keys).toEqual([KEY1, KEY2]);
  });
});
