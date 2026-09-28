CREATE TABLE "payment_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"blob_path" text,
	"file_name" text,
	"content_type" text,
	"size" integer,
	"sha256" text,
	"added_by" uuid NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"removed_at" timestamp,
	"removed_by" uuid
);
--> statement-breakpoint
CREATE TABLE "project_letters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"project_key" text NOT NULL,
	"project_name" text NOT NULL,
	"blob_path" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text NOT NULL,
	"added_by" uuid NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"removed_at" timestamp,
	"removed_by" uuid
);
--> statement-breakpoint
ALTER TABLE "payment_documents" ADD CONSTRAINT "payment_documents_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_documents" ADD CONSTRAINT "payment_documents_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_documents" ADD CONSTRAINT "payment_documents_removed_by_users_id_fk" FOREIGN KEY ("removed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_letters" ADD CONSTRAINT "project_letters_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_letters" ADD CONSTRAINT "project_letters_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_letters" ADD CONSTRAINT "project_letters_removed_by_users_id_fk" FOREIGN KEY ("removed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_documents_txn_idx" ON "payment_documents" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "project_letters_school_idx" ON "project_letters" USING btree ("school_id","project_key");