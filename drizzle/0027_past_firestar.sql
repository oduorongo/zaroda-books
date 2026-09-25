CREATE TABLE "audit_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"transaction_id" uuid,
	"subject" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"raised_by" uuid NOT NULL,
	"raised_at" timestamp DEFAULT now() NOT NULL,
	"closed_by" uuid,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "audit_query_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"from_auditor" boolean NOT NULL,
	"body" text NOT NULL,
	"at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_queries" ADD CONSTRAINT "audit_queries_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_queries" ADD CONSTRAINT "audit_queries_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_queries" ADD CONSTRAINT "audit_queries_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_queries" ADD CONSTRAINT "audit_queries_raised_by_users_id_fk" FOREIGN KEY ("raised_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_queries" ADD CONSTRAINT "audit_queries_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_query_messages" ADD CONSTRAINT "audit_query_messages_query_id_audit_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."audit_queries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_query_messages" ADD CONSTRAINT "audit_query_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_queries_account_idx" ON "audit_queries" USING btree ("account_id","status");--> statement-breakpoint
CREATE INDEX "audit_query_messages_query_idx" ON "audit_query_messages" USING btree ("query_id","at");