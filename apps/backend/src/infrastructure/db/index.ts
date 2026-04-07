import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://chat:password@localhost:5432/chat_at_scale',
});

export const db = drizzle(pool, { schema });
