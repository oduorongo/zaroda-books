CREATE TABLE "letter_details" (
	"school_id" uuid PRIMARY KEY NOT NULL,
	"short_name" text,
	"postal_address" text,
	"town" text,
	"scde_address" text,
	"scde_town" text,
	"ministry_name" text,
	"ministry_address" text,
	"ministry_email" text,
	"signatory_name" text,
	"signatory_title" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "bank_branch" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "position" text;--> statement-breakpoint
ALTER TABLE "letter_details" ADD CONSTRAINT "letter_details_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_details" ADD CONSTRAINT "letter_details_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;