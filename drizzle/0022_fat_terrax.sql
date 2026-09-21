CREATE TABLE "problems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp DEFAULT now() NOT NULL,
	"area" text NOT NULL,
	"message" text NOT NULL,
	"detail" text,
	"org_id" uuid,
	"seen_at" timestamp,
	"seen_by" uuid
);
--> statement-breakpoint
ALTER TABLE "problems" ADD CONSTRAINT "problems_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problems" ADD CONSTRAINT "problems_seen_by_users_id_fk" FOREIGN KEY ("seen_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "problems_at_idx" ON "problems" USING btree ("at");