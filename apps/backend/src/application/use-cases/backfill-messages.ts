import { db } from '../../infrastructure/db';
import { messages } from '../../infrastructure/db/schema';
import { and, gt, eq, asc } from 'drizzle-orm';

export class BackfillMessagesUseCase {
  async execute(conversationId: string, cursorOffset: number) {
    // 1. Fetch missed messages exclusively greater than the given structural sequence cursor
    // 2. Ascending order guarantees correct reconstruction in the target client App
    const missedMessages = await db.select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          gt(messages.sequence, cursorOffset) // Cursor pagination!
        )
      )
      .orderBy(asc(messages.sequence));

    return missedMessages;
  }
}
