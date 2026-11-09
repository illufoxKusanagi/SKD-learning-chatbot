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
  index,
  uniqueIndex,
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

export const ragData = pgTable(
  "rag_data",
  {
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
  },
  (table) => [
    index("rag_data_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
    uniqueIndex("rag_data_external_id_uidx").on(table.external_id),
  ]
);

export const conversations = pgTable("chat_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  isGuestChat: boolean("is_guest_chat").default(false),
  guestSessionId: text("guest_session_id"), // For identifying guest sessions
  expiresAt: timestamp("expires_at"), // For auto-deletion
});

export const quizAttempts = pgTable("quiz_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatId: uuid("chat_id")
    .references(() => conversations.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  ragSourceId: varchar("rag_source_id", { length: 255 }),
  category: varchar("category", { length: 10 }).notNull(),
  subtopic: text("subtopic").notNull(),
  questionStem: text("question_stem").notNull(),
  options: jsonb("options")
    .$type<{ A: string; B: string; C: string; D: string; E: string }>()
    .notNull(),
  correctOption: varchar("correct_option", { length: 5 }).notNull(),
  scoringRubric: jsonb("scoring_rubric")
    .$type<{ A: number; B: number; C: number; D: number; E: number }>()
    .notNull(),
  rubricRationale: text("rubric_rationale").notNull(),
  userAnswer: varchar("user_answer", { length: 5 }),
  scoreEarned: integer("score_earned"),
  maxScore: integer("max_score").default(5).notNull(),
  aiExplanation: text("ai_explanation"),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  answeredAt: timestamp("answered_at"),
});

export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;

export type InsertRagData = typeof ragData.$inferInsert;
export type SelectRagData = typeof ragData.$inferSelect;

export type Insertconversations = typeof conversations.$inferInsert;
export type Selectconversations = typeof conversations.$inferSelect;

export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type NewQuizAttempt = typeof quizAttempts.$inferInsert;
export type QuizOptions = { A: string; B: string; C: string; D: string; E: string };
export type QuizScoringRubric = { A: number; B: number; C: number; D: number; E: number };
