import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './auth';

describe('Auth Crypto Utilities', () => {
  it('should hash a password consistently and verify it correctly', async () => {
    const password = 'super_secure_password_123';
    
    // Hash the password
    const hashed = await hashPassword(password);
    
    // Ensure the hash has the format expected (hash.salt)
    expect(hashed).toContain('.');
    const [hash, salt] = hashed.split('.');
    expect(hash).toBeTruthy();
    expect(salt).toBeTruthy();
    
    // Verification should succeed with correct password
    const isValid = await verifyPassword(password, hashed);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect passwords', async () => {
    const password = 'my_password';
    const hashed = await hashPassword(password);
    
    // Verification should fail with wrong password
    const isInvalid = await verifyPassword('wrong_password', hashed);
    expect(isInvalid).toBe(false);
  });
});
