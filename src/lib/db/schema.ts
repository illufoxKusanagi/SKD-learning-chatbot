import {
  pgTable,
  text,
  jsonb,
  timestamp,
  integer,
  vector,
  uuid,
  real,
  boolean,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  email: text("email").notNull().unique(),
  role: varchar("role").default("user").notNull(),
  avatar: text("avatar"),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastLogin: timestamp("last_login"),
});

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  chatId: uuid("chat_id")
    .references(() => conversations.id)
    .notNull(),
  role: varchar("role", { length: 20 }).notNull(), // user or bot
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ragData = pgTable("rag_data", {
  id: uuid("id").primaryKey().defaultRandom(),
  content: text("content").notNull(),
  data: jsonb("data").notNull(),
  embedding: vector("embedding", { dimensions: 768 }),
  title: text("title"),
  source: varchar("source", { length: 50 }).default("internal").notNull(),
  external_id: varchar("external_id", { length: 255 }),

  is_cached: boolean("is_cached").default(false),
  cache_expires_at: timestamp("cache_expires_at"),
  last_fetched_at: timestamp("last_fetched_at"),

  similarity_score: real("similarity_score"),
  fetch_count: integer("fetch_count").default(0),

  api_response_metadata: jsonb("api_response_metadata"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const conversations = pgTable("chat_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  isGuestChat: boolean("is_guest_chat").default(false),
  guestSessionId: text("guest_session_id"), // For identifying guest sessions
  expiresAt: timestamp("expires_at"), // For auto-deletion
});

export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;

export type InsertRagData = typeof ragData.$inferInsert;
export type SelectRagData = typeof ragData.$inferSelect;

export type Insertconversations = typeof conversations.$inferInsert;
export type Selectconversations = typeof conversations.$inferSelect;
