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
  bigint,
  primaryKey,
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

export interface StudyMaterialSourceMeta {
  author?: string;
  publisher?: string;
  publishedYear?: number;
  regulation?: string;
  license?: string;
  tags?: string[];
  [key: string]: unknown;
}

export type QuizOptions = { A: string; B: string; C: string; D: string; E: string };
export type QuizScoringRubric = { A: number; B: number; C: number; D: number; E: number };

export const studyMaterials = pgTable(
  "study_materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 160 }).notNull().unique(),
    title: text("title").notNull(),
    category: varchar("category", { length: 10 }).default("TWK").notNull(),
    subtopic: text("subtopic").notNull(),
    summary: text("summary").notNull(),
    contentMarkdown: text("content_markdown").notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    sourceType: varchar("source_type", { length: 30 }).default("manual").notNull(),
    sourceUrl: text("source_url"),
    sourceMeta: jsonb("source_meta").$type<StudyMaterialSourceMeta | null>(),
    embedding: vector("embedding", { dimensions: 768 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("study_materials_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
    index("study_materials_subtopic_idx").on(table.category, table.subtopic),
  ]
);

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 160 }).notNull().unique(),
    category: varchar("category", { length: 10 }).notNull(),
    subtopic: text("subtopic").notNull(),
    difficulty: varchar("difficulty", { length: 20 }).default("hots").notNull(),
    reasoningChain: text("reasoning_chain").notNull(),
    stem: text("stem").notNull(),
    options: jsonb("options").$type<QuizOptions>().notNull(),
    hint: text("hint").notNull(),
    correctOption: varchar("correct_option", { length: 5 }),
    scoringRubric: jsonb("scoring_rubric").$type<QuizScoringRubric | null>(),
    optionRationales: jsonb("option_rationales").$type<QuizOptions>().notNull(),
    sourceUrl: text("source_url"),
    sourceMeta: jsonb("source_meta").$type<StudyMaterialSourceMeta | null>(),
    isValidated: boolean("is_validated").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("quiz_questions_cat_subtopic_idx").on(
      table.category,
      table.subtopic,
      table.isValidated
    ),
  ]
);

export const quizQuestionMaterials = pgTable(
  "quiz_question_materials",
  {
    questionId: uuid("question_id")
      .references(() => quizQuestions.id, { onDelete: "cascade" })
      .notNull(),
    materialId: uuid("material_id")
      .references(() => studyMaterials.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.questionId, table.materialId] }),
    index("quiz_question_materials_material_idx").on(table.materialId),
  ]
);

export const quizSessions = pgTable("quiz_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  guestSessionId: text("guest_session_id"),
  mode: varchar("mode", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).default("in_progress").notNull(),
  durationSeconds: integer("duration_seconds"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  questionOrder: jsonb("question_order").$type<string[]>().notNull(),
  flaggedQuestionIds: jsonb("flagged_question_ids")
    .$type<string[]>()
    .default([])
    .notNull(),
  scoreSummary: jsonb("score_summary").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chatId: uuid("chat_id").references(() => conversations.id, {
      onDelete: "cascade",
    }),
    sessionId: uuid("session_id").references(() => quizSessions.id, {
      onDelete: "cascade",
    }),
    questionId: uuid("question_id").references(() => quizQuestions.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    ragSourceId: varchar("rag_source_id", { length: 255 }),
    category: varchar("category", { length: 10 }).notNull(),
    subtopic: text("subtopic").notNull(),
    questionStem: text("question_stem").notNull(),
    options: jsonb("options").$type<QuizOptions>().notNull(),
    correctOption: varchar("correct_option", { length: 5 }),
    scoringRubric: jsonb("scoring_rubric").$type<QuizScoringRubric | null>(),
    rubricRationale: text("rubric_rationale"),
    userAnswer: varchar("user_answer", { length: 5 }),
    scoreEarned: integer("score_earned"),
    maxScore: integer("max_score").default(5).notNull(),
    aiExplanation: text("ai_explanation"),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    timeSpentSeconds: integer("time_spent_seconds"),
    usedHint: boolean("used_hint").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    answeredAt: timestamp("answered_at"),
  },
  (table) => [
    uniqueIndex("quiz_attempts_session_question_uidx").on(
      table.sessionId,
      table.questionId
    ),
  ]
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: bigint("window_start", { mode: "number" }).notNull(),
    count: integer("count").default(0).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.key, table.windowStart] }),
  ]
);

export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;

export type InsertRagData = typeof ragData.$inferInsert;
export type SelectRagData = typeof ragData.$inferSelect;

export type Insertconversations = typeof conversations.$inferInsert;
export type Selectconversations = typeof conversations.$inferSelect;

export type StudyMaterial = typeof studyMaterials.$inferSelect;
export type NewStudyMaterial = typeof studyMaterials.$inferInsert;

export type QuizQuestionRecord = typeof quizQuestions.$inferSelect;
export type NewQuizQuestionRecord = typeof quizQuestions.$inferInsert;

export type QuizQuestionMaterial = typeof quizQuestionMaterials.$inferSelect;
export type NewQuizQuestionMaterial = typeof quizQuestionMaterials.$inferInsert;

export type QuizSession = typeof quizSessions.$inferSelect;
export type NewQuizSession = typeof quizSessions.$inferInsert;

export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type NewQuizAttempt = typeof quizAttempts.$inferInsert;
export type RateLimit = typeof rateLimits.$inferSelect;
export type NewRateLimit = typeof rateLimits.$inferInsert;
