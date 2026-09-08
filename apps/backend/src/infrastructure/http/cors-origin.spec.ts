import { describe, it, expect } from 'vitest';
import { resolveCorsOrigin } from './cors-origin';

describe('resolveCorsOrigin', () => {
  it('defaults to the Vite dev origin', () => {
    expect(resolveCorsOrigin(undefined)).toBe('http://localhost:5173');
    expect(resolveCorsOrigin('')).toBe('http://localhost:5173');
    expect(resolveCorsOrigin('   ')).toBe('http://localhost:5173');
  });

  it('accepts an explicit origin', () => {
    expect(resolveCorsOrigin('http://localhost:5173')).toBe('http://localhost:5173');
    expect(resolveCorsOrigin(' https://chat.example.com ')).toBe('https://chat.example.com');
  });

  it('rejects wildcard origin when credentials are in use', () => {
    expect(() => resolveCorsOrigin('*')).toThrow(/cannot be "\*"/);
  });
});
