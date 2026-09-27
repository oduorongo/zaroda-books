CREATE TABLE "authorisation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"route" text NOT NULL,
	"payments" text NOT NULL,
	"hoi_name" text NOT NULL,
	"hoi_tsc" text,
	"sent_to" text,
	"token_hash" text,
	"code_hash" text,
	"code_issued_at" timestamp,
	"code_tries" integer DEFAULT 0 NOT NULL,
	"codes_sent" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"signed_on" date,
	CONSTRAINT "authorisation_requests_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "payment_authorisations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"request_id" uuid,
	"decision" text NOT NULL,
	"terms" text NOT NULL,
	"reason" text,
	"route" text NOT NULL,
	"hoi_name" text NOT NULL,
	"hoi_tsc" text,
	"sent_to" text,
	"signed_on" date,
	"authorised_by" uuid,
	"recorded_by" uuid,
	"at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "auth_route" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "hoi_name" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "hoi_tsc" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "hoi_email" text;--> statement-breakpoint
ALTER TABLE "authorisation_requests" ADD CONSTRAINT "authorisation_requests_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorisation_requests" ADD CONSTRAINT "authorisation_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_authorisations" ADD CONSTRAINT "payment_authorisations_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_authorisations" ADD CONSTRAINT "payment_authorisations_request_id_authorisation_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."authorisation_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_authorisations" ADD CONSTRAINT "payment_authorisations_authorised_by_users_id_fk" FOREIGN KEY ("authorised_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_authorisations" ADD CONSTRAINT "payment_authorisations_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "authorisation_requests_account_idx" ON "authorisation_requests" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_authorisations_txn_idx" ON "payment_authorisations" USING btree ("transaction_id","at");