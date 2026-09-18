ALTER TABLE "periods" ADD COLUMN "statement_bank" bigint;--> statement-breakpoint
ALTER TABLE "periods" ADD COLUMN "statement_date" date;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "cleared_on" date;