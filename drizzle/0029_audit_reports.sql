CREATE TABLE "audit_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"auditor_id" uuid NOT NULL,
	"authored_by" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"account_id" uuid,
	"years" text,
	"period_from" date,
	"period_to" date,
	"content" text DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"snapshot" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"issued_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "audit_reports" ADD CONSTRAINT "audit_reports_auditor_id_auditors_id_fk" FOREIGN KEY ("auditor_id") REFERENCES "public"."auditors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_reports" ADD CONSTRAINT "audit_reports_authored_by_users_id_fk" FOREIGN KEY ("authored_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_reports" ADD CONSTRAINT "audit_reports_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_reports" ADD CONSTRAINT "audit_reports_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_reports_school_idx" ON "audit_reports" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "audit_reports_author_idx" ON "audit_reports" USING btree ("authored_by");