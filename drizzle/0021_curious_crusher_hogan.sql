CREATE TABLE "login_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"ip" text,
	"at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "login_failures_email_idx" ON "login_failures" USING btree ("email","at");--> statement-breakpoint
CREATE INDEX "login_failures_ip_idx" ON "login_failures" USING btree ("ip","at");