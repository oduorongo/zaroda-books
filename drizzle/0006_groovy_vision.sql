ALTER TABLE "accounts" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "archived_by" uuid;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_archived_by_users_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;