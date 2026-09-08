const DEFAULT_DEV_ORIGIN = 'http://localhost:5173';

/**
 * CORS origin for credentialed requests.
 * Browsers reject `Access-Control-Allow-Origin: *` when `credentials: true`.
 * A wildcard here is also an AppSec footgun: any site could make credentialed calls.
 */
export function resolveCorsOrigin(
  raw: string | undefined = process.env.CORS_ORIGIN,
): string {
  const origin = raw?.trim() || DEFAULT_DEV_ORIGIN;
  if (origin === '*') {
    throw new Error('CORS_ORIGIN cannot be "*" when credentials are enabled');
  }
  return origin;
}
