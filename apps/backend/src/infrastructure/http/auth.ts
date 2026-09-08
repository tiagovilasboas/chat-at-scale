import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { db } from '../db';
import { users, sessions } from '../db/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const JWT_SECRET = process.env.JWT_SECRET || 'staff_principal_secret';
export const MIN_PASSWORD_LENGTH = 8;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type AuthBody = {
  username?: string;
  password?: string;
};

type CookieRequest = FastifyRequest<{ Body?: AuthBody }>;

export type SessionRevoker = {
  revokeByToken: (token: string) => Promise<void>;
};

function authCookieOptions(): {
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  maxAge?: number;
} {
  return {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  };
}

const defaultSessionRevoker: SessionRevoker = {
  async revokeByToken(token: string): Promise<void> {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.token, token));
  },
};

export function validateCredentials(
  username: unknown,
  password: unknown,
): string | null {
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return 'Username and password required';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return null;
}

/**
 * Constant-time compare of two hex digests.
 * Length mismatches return false without throwing and without skipping a compare.
 */
export function timingSafeHexEqual(computedHex: string, storedHex: string): boolean {
  const computed = Buffer.from(computedHex, 'hex');
  const stored = Buffer.from(storedHex, 'hex');
  if (computed.length !== stored.length) {
    timingSafeEqual(computed, computed);
    return false;
  }
  return timingSafeEqual(computed, stored);
}

export function readSessionToken(cookies: { token?: string } | undefined): string | undefined {
  const token = cookies?.token;
  return typeof token === 'string' && token.length > 0 ? token : undefined;
}

/**
 * Revokes the DB session for the given JWT when present.
 * Cookie clearing is the HTTP layer's job so this stays unit-testable without Fastify.
 */
export async function revokeSessionIfPresent(
  token: string | undefined,
  revoker: SessionRevoker = defaultSessionRevoker,
): Promise<{ revoked: boolean }> {
  if (!token) {
    return { revoked: false };
  }
  await revoker.revokeByToken(token);
  return { revoked: true };
}

// Using native NodeJS crypto prevents brittle C++ bindings missing from bcrypt
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [hash, salt] = storedHash.split('.');
  if (!hash || !salt) {
    return false;
  }
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeHexEqual(buf.toString('hex'), hash);
}

export function setupAuthRoutes(fastify: FastifyInstance): void {
  fastify.post('/api/auth/register', async (req: CookieRequest, reply: FastifyReply) => {
    const { username, password } = req.body ?? {};
    const validationError = validateCredentials(username, password);
    if (validationError) {
      return reply.code(400).send({ error: validationError });
    }

    try {
      const pHash = await hashPassword(password as string);
      const userId = `usr_${randomBytes(8).toString('hex')}`;

      const [newUser] = await db.insert(users).values({
        id: userId,
        username: username as string,
        passwordHash: pHash,
      }).returning({ id: users.id, username: users.username });

      return reply.code(201).send({ message: 'Registered', user: newUser });
    } catch (err: unknown) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? (err as { code?: string }).code : undefined;
      if (code === '23505') return reply.code(409).send({ error: 'Username taken' });
      throw err;
    }
  });

  fastify.post('/api/auth/login', async (req: CookieRequest, reply: FastifyReply) => {
    const { username, password } = req.body ?? {};
    const validationError = validateCredentials(username, password);
    if (validationError) {
      return reply.code(400).send({ error: validationError });
    }

    try {
      const [user] = await db.select().from(users).where(eq(users.username, username as string)).limit(1);
      if (!user) return reply.code(401).send({ error: 'Invalid credentials' });

      const isValid = await verifyPassword(password as string, user.passwordHash);
      if (!isValid) return reply.code(401).send({ error: 'Invalid credentials' });

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

      await db.insert(sessions).values({ userId: user.id, token, expiresAt });

      reply.setCookie('token', token, {
        ...authCookieOptions(),
        maxAge: SESSION_TTL_MS / 1000,
      });

      return reply.send({ userId: user.id, username: user.username });
    } catch (err: unknown) {
      fastify.log.error(err, 'Login route error');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post('/api/auth/logout', async (req: CookieRequest, reply: FastifyReply) => {
    const token = readSessionToken(req.cookies);
    await revokeSessionIfPresent(token);
    reply.clearCookie('token', authCookieOptions());
    return reply.send({ message: 'Logged out' });
  });

  // Global error handler — prevents raw unhandled rejections from leaking stack traces
  fastify.setErrorHandler((error: { statusCode?: number; message: string }, _req, reply) => {
    fastify.log.error(error);
    const statusCode = error.statusCode ?? 500;
    reply.code(statusCode).send({
      error: statusCode >= 500 ? 'Internal server error' : error.message,
    });
  });
}
