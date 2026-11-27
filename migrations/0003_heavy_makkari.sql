CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid,
	"session_id" uuid,
	"question_id" uuid,
	"user_id" uuid,
	"rag_source_id" varchar(255),
	"category" varchar(10) NOT NULL,
	"subtopic" text NOT NULL,
	"question_stem" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_option" varchar(5),
	"scoring_rubric" jsonb,
	"rubric_rationale" text,
	"user_answer" varchar(5),
	"score_earned" integer,
	"max_score" integer DEFAULT 5 NOT NULL,
	"ai_explanation" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"time_spent_seconds" integer,
	"used_hint" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"answered_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "quiz_question_materials" (
	"question_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	CONSTRAINT "quiz_question_materials_question_id_material_id_pk" PRIMARY KEY("question_id","material_id")
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(160) NOT NULL,
	"category" varchar(10) NOT NULL,
	"subtopic" text NOT NULL,
	"difficulty" varchar(20) DEFAULT 'hots' NOT NULL,
	"reasoning_chain" text NOT NULL,
	"stem" text NOT NULL,
	"options" jsonb NOT NULL,
	"hint" text NOT NULL,
	"correct_option" varchar(5),
	"scoring_rubric" jsonb,
	"option_rationales" jsonb NOT NULL,
	"source_url" text,
	"source_meta" jsonb,
	"is_validated" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_questions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "quiz_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"guest_session_id" text,
	"mode" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'in_progress' NOT NULL,
	"duration_seconds" integer,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"question_order" jsonb NOT NULL,
	"flagged_question_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"score_summary" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" bigint NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "study_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(160) NOT NULL,
	"title" text NOT NULL,
	"category" varchar(10) DEFAULT 'TWK' NOT NULL,
	"subtopic" text NOT NULL,
	"summary" text NOT NULL,
	"content_markdown" text NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"source_type" varchar(30) DEFAULT 'manual' NOT NULL,
	"source_url" text,
	"source_meta" jsonb,
	"embedding" vector(768),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "study_materials_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_chat_id_chat_history_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat_history"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_session_id_quiz_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."quiz_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_question_id_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_question_materials" ADD CONSTRAINT "quiz_question_materials_question_id_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_question_materials" ADD CONSTRAINT "quiz_question_materials_material_id_study_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."study_materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_attempts_session_question_uidx" ON "quiz_attempts" USING btree ("session_id","question_id");--> statement-breakpoint
CREATE INDEX "quiz_question_materials_material_idx" ON "quiz_question_materials" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "quiz_questions_cat_subtopic_idx" ON "quiz_questions" USING btree ("category","subtopic","is_validated");--> statement-breakpoint
CREATE INDEX "study_materials_embedding_idx" ON "study_materials" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "study_materials_subtopic_idx" ON "study_materials" USING btree ("category","subtopic");--> statement-breakpoint
CREATE INDEX "rag_data_embedding_idx" ON "rag_data" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "rag_data_external_id_uidx" ON "rag_data" USING btree ("external_id");