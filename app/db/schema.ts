import { pgTable, text, timestamp, uuid, jsonb, integer, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// User accounts (managed by NextAuth)
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Document types enum
export const documentTypeEnum = pgEnum("document_type", [
  "audio",
  "document",
  "web",
  "text",
  "image",
]);

// Main content storage
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: documentTypeEnum("type").notNull(),
  title: text("title"),
  contentEncrypted: text("content_encrypted").notNull(), // Base64 encoded encrypted content
  metadataJson: jsonb("metadata_json"),
  sourceUrl: text("source_url"),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Text chunks for embedding
export const chunks = pgTable("chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  contentEncrypted: text("content_encrypted").notNull(), // Base64 encoded encrypted content
  startChar: integer("start_char"),
  endChar: integer("end_char"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Vector embeddings (pgvector)
// Note: pgvector extension needs to be enabled in database
export const embeddings = pgTable("embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  chunkId: uuid("chunk_id")
    .notNull()
    .references(() => chunks.id, { onDelete: "cascade" }),
  embedding: text("embedding").notNull(), // Will be vector(1536) type, stored as text for now
  model: text("model").notNull().default("text-embedding-3-small"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Chat sessions
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Chat messages
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "user" or "assistant"
  contentEncrypted: text("content_encrypted").notNull(), // Base64 encoded encrypted content
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Note: Using JWT sessions - no accounts or session tables needed

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
  sessions: many(sessions),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
  chunks: many(chunks),
}));

export const chunksRelations = relations(chunks, ({ one, many }) => ({
  document: one(documents, {
    fields: [chunks.documentId],
    references: [documents.id],
  }),
  embeddings: many(embeddings),
}));

export const embeddingsRelations = relations(embeddings, ({ one }) => ({
  chunk: one(chunks, {
    fields: [embeddings.chunkId],
    references: [chunks.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(sessions, {
    fields: [messages.sessionId],
    references: [sessions.id],
  }),
}));

