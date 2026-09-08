import { describe, it, expect, vi } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  timingSafeHexEqual,
  validateCredentials,
  MIN_PASSWORD_LENGTH,
  readSessionToken,
  revokeSessionIfPresent,
} from './auth';

describe('Auth Crypto Utilities', () => {
  it('should hash a password consistently and verify it correctly', async () => {
    const password = 'super_secure_password_123';

    const hashed = await hashPassword(password);

    expect(hashed).toContain('.');
    const [hash, salt] = hashed.split('.');
    expect(hash).toBeTruthy();
    expect(salt).toBeTruthy();

    const isValid = await verifyPassword(password, hashed);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect passwords', async () => {
    const password = 'my_password';
    const hashed = await hashPassword(password);

    const isInvalid = await verifyPassword('wrong_password', hashed);
    expect(isInvalid).toBe(false);
  });

  it('should reject malformed stored hashes without throwing', async () => {
    await expect(verifyPassword('any-password', 'not-a-valid-hash')).resolves.toBe(false);
    await expect(verifyPassword('any-password', '')).resolves.toBe(false);
  });
});

describe('timingSafeHexEqual', () => {
  it('returns true for identical equal-length digests', () => {
    const hex = 'ab'.repeat(64);
    expect(timingSafeHexEqual(hex, hex)).toBe(true);
  });

  it('returns false for different equal-length digests', () => {
    const a = 'ab'.repeat(64);
    const b = 'cd'.repeat(64);
    expect(timingSafeHexEqual(a, b)).toBe(false);
  });

  it('returns false on length mismatch without throwing', () => {
    expect(() => timingSafeHexEqual('aa', 'aabb')).not.toThrow();
    expect(timingSafeHexEqual('aa', 'aabb')).toBe(false);
    expect(timingSafeHexEqual('', 'aa')).toBe(false);
  });
});

describe('validateCredentials', () => {
  it('requires username and password', () => {
    expect(validateCredentials('', 'longenough')).toBe('Username and password required');
    expect(validateCredentials('alice', '')).toBe('Username and password required');
    expect(validateCredentials(undefined, undefined)).toBe('Username and password required');
  });

  it(`rejects passwords shorter than ${MIN_PASSWORD_LENGTH} characters`, () => {
    expect(validateCredentials('alice', 'short')).toBe(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  });

  it('accepts valid credentials', () => {
    expect(validateCredentials('alice', 'longenough')).toBeNull();
  });
});

describe('logout session revoke', () => {
  it('reads the token from the HttpOnly cookie bag', () => {
    expect(readSessionToken({ token: 'jwt-abc' })).toBe('jwt-abc');
    expect(readSessionToken({ token: '' })).toBeUndefined();
    expect(readSessionToken(undefined)).toBeUndefined();
  });

  it('revokes the matching session when a token is present', async () => {
    const revokeByToken = vi.fn().mockResolvedValue(undefined);
    const result = await revokeSessionIfPresent('jwt-abc', { revokeByToken });
    expect(revokeByToken).toHaveBeenCalledOnce();
    expect(revokeByToken).toHaveBeenCalledWith('jwt-abc');
    expect(result).toEqual({ revoked: true });
  });

  it('skips DB work when the cookie is missing (still a successful logout)', async () => {
    const revokeByToken = vi.fn();
    const result = await revokeSessionIfPresent(undefined, { revokeByToken });
    expect(revokeByToken).not.toHaveBeenCalled();
    expect(result).toEqual({ revoked: false });
  });
});
