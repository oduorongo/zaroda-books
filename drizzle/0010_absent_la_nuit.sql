ALTER TABLE "orgs" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
-- Every org that exists predates approval and is already keeping books, so it
-- is approved as of the day it signed up. Without this they would be locked
-- out of opening a book the moment this deploys.
UPDATE "orgs" SET "approved_at" = "created_at" WHERE "approved_at" IS NULL;
