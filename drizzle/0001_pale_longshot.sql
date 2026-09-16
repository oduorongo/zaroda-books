CREATE TABLE "vote_head_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"financial_year_id" uuid NOT NULL,
	"vote_head_id" uuid NOT NULL,
	"per_learner" bigint NOT NULL,
	CONSTRAINT "vote_head_rates_financial_year_id_vote_head_id_unique" UNIQUE("financial_year_id","vote_head_id")
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "enrolment" integer;--> statement-breakpoint
ALTER TABLE "vote_head_rates" ADD CONSTRAINT "vote_head_rates_financial_year_id_financial_years_id_fk" FOREIGN KEY ("financial_year_id") REFERENCES "public"."financial_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_head_rates" ADD CONSTRAINT "vote_head_rates_vote_head_id_vote_heads_id_fk" FOREIGN KEY ("vote_head_id") REFERENCES "public"."vote_heads"("id") ON DELETE no action ON UPDATE no action;