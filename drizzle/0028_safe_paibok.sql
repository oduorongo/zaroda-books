ALTER TABLE "accounts" ADD COLUMN "audit_sent_to" uuid;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "audit_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "audit_sent_by" uuid;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_audit_sent_to_auditors_id_fk" FOREIGN KEY ("audit_sent_to") REFERENCES "public"."auditors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_audit_sent_by_users_id_fk" FOREIGN KEY ("audit_sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;