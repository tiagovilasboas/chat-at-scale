import { pgTable, varchar, timestamp, uuid, integer, primaryKey, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(),
  username: varchar('username', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const conversationMembers = pgTable('conversation_members', {
  conversationId: uuid('conversation_id').references(() => conversations.id).notNull(),
  userId: varchar('user_id').references(() => users.id).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.conversationId, table.userId] })
]);

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').references(() => conversations.id).notNull(),
  sequence: integer('sequence').notNull(),
  senderId: varchar('sender_id').references(() => users.id).notNull(),
  content: varchar('content', { length: 2000 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_conversation_sequence').on(table.conversationId, table.sequence)
]);
