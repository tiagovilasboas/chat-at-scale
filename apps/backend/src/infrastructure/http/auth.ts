import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { users, sessions } from '../db/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const JWT_SECRET = process.env.JWT_SECRET || 'staff_principal_secret';

// Using native NodeJS crypto prevents brittle C++ bindings missing from bcrypt
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [hash, salt] = storedHash.split('.');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return buf.toString('hex') === hash;
}

export function setupAuthRoutes(fastify: FastifyInstance) {
  fastify.post('/api/auth/register', async (req: any, reply) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return reply.code(400).send({ error: "Username and password required" });
    }

    try {
      const pHash = await hashPassword(password);
      const userId = `usr_${randomBytes(8).toString('hex')}`;
      
      const [newUser] = await db.insert(users).values({
        id: userId,
        username,
        passwordHash: pHash
      }).returning({ id: users.id, username: users.username });

      return reply.code(201).send({ message: "Registered", user: newUser });
    } catch (err: any) {
      if (err.code === '23505') return reply.code(409).send({ error: "Username taken" });
      throw err;
    }
  });

  fastify.post('/api/auth/login', async (req: any, reply) => {
    const { username, password } = req.body;

    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!user) return reply.code(401).send({ error: "Invalid credentials" });

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) return reply.code(401).send({ error: "Invalid credentials" });

    // Stateful Session Mapping (Token tracked in Postgres)
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 Days
    
    await db.insert(sessions).values({
      userId: user.id,
      token,
      expiresAt
    });

    return reply.send({ token, userId: user.id, username: user.username });
  });
}
