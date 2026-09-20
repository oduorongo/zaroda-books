ALTER TABLE "subscription_payments" ADD COLUMN "pending_school_name" text;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD COLUMN "pending_account_type" text;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD COLUMN "created_account_id" uuid;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_created_account_id_accounts_id_fk" FOREIGN KEY ("created_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;