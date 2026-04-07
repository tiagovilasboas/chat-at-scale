import { db } from '../../infrastructure/db';
import { users, conversations } from '../../infrastructure/db/schema';
import { sql } from 'drizzle-orm';

export class BroadcastMessageUseCase {
  async execute(dto: { conversationId: string, senderId: string, content: string }) {
    // 1. Ensure User exist (MVP stubbing Auth flow)
    await db.insert(users)
      .values({ id: dto.senderId, username: dto.senderId })
      .onConflictDoNothing();

    // 2. Ensure Conversation exist (MVP defaults)
    await db.insert(conversations)
      .values({ id: dto.conversationId })
      .onConflictDoNothing();

    // 3. Write-Through Message Insertion (Sequence guarantees via DB)
    // Subquery retrieves the max sequence lock-free for single node MVP.
    // In production, an atomic returning table or advisory locks might apply here
    const result = await db.execute(sql`
      WITH next_seq AS (
        SELECT COALESCE(MAX(sequence), 0) + 1 AS seq 
        FROM messages 
        WHERE conversation_id = ${dto.conversationId}
      )
      INSERT INTO messages (conversation_id, sender_id, content, sequence)
      SELECT ${dto.conversationId}, ${dto.senderId}, ${dto.content}, seq FROM next_seq
      RETURNING id, sequence, created_at as "createdAt";
    `);

    return {
      ...dto,
      id: result.rows[0].id as string,
      sequence: result.rows[0].sequence as number,
      createdAt: result.rows[0].createdAt
    };
  }
}
