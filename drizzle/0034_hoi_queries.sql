CREATE TABLE "query_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"sent_to" text NOT NULL,
	"hoi_name" text NOT NULL,
	"hoi_tsc" text,
	"code_hash" text,
	"code_issued_at" timestamp,
	"code_tries" integer DEFAULT 0 NOT NULL,
	"codes_sent" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "query_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "audit_query_messages" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_queries" ADD COLUMN "addressed_to" text DEFAULT 'school' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_queries" ADD COLUMN "reminded_at" timestamp;--> statement-breakpoint
ALTER TABLE "audit_query_messages" ADD COLUMN "from_hoi" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_query_messages" ADD COLUMN "author_name" text;--> statement-breakpoint
ALTER TABLE "audit_query_messages" ADD COLUMN "via" text;--> statement-breakpoint
ALTER TABLE "query_links" ADD CONSTRAINT "query_links_query_id_audit_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."audit_queries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "query_links_query_idx" ON "query_links" USING btree ("query_id");