ALTER TABLE "messages" DROP CONSTRAINT "messages_chat_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_chat_history_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat_history"("id") ON DELETE no action ON UPDATE no action;