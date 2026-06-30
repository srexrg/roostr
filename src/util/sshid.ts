/**
 * Utilities for fetching SSH public keys from sshid.io.
 */

const HANDLE_RE = /^[A-Za-z0-9._-]+$/;

/**
 * Returns true when `handle` is a valid sshid.io handle:
 * non-empty, only letters, digits, dots, underscores, and hyphens.
 */
export function validateSshIdHandle(handle: string): boolean {
  return HANDLE_RE.test(handle);
}

/** Minimal fetch signature used by fetchSshIdKeys - allows injecting a fake in tests. */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'text'>>;

/**
 * Fetches the public keys for a given sshid.io handle.
 *
 * - Strips a leading `@` and surrounding whitespace before validating.
 * - GETs `https://sshid.io/<handle>` with `Accept: text/plain`.
 * - Throws on non-200, HTML response, or no keys found.
 * - `fetchImpl` defaults to the global `fetch`; inject a fake for tests.
 */
export async function fetchSshIdKeys(
  rawHandle: string,
  fetchImpl: FetchLike = fetch,
): Promise<string[]> {
  // Strip leading @ and surrounding whitespace
  const handle = rawHandle.trim().replace(/^@/, '').trim();

  if (!validateSshIdHandle(handle)) {
    throw new Error(
      `invalid sshid.io handle: ${JSON.stringify(rawHandle)} - use letters, digits, . _ - only`,
    );
  }

  const url = `https://sshid.io/${handle}`;
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'text/plain',
      'User-Agent': 'roostr',
    },
  });

  if (!response.ok) {
    throw new Error(
      `sshid.io returned ${response.status} for @${handle} - check the handle is correct`,
    );
  }

  const body = await response.text();

  // Detect HTML response (sshid.io sometimes returns a login page)
  if (/<(!doctype|html)/i.test(body)) {
    throw new Error(
      `no public keys published for @${handle} - add a device in Termius SSH ID first`,
    );
  }

  // Parse authorized_keys format: split lines, trim, drop empties and # comments
  const keys = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  if (keys.length === 0) {
    throw new Error(
      `no public keys published for @${handle} - add a device in Termius SSH ID first`,
    );
  }

  return keys;
}
