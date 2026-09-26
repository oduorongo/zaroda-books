CREATE TABLE "hoi_handovers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"officer" text NOT NULL,
	"tsc_no" text NOT NULL,
	"reason" text NOT NULL,
	"handover_date" date NOT NULL,
	"recorded_by" uuid NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hoi_handovers" ADD CONSTRAINT "hoi_handovers_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hoi_handovers" ADD CONSTRAINT "hoi_handovers_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hoi_handovers_school_idx" ON "hoi_handovers" USING btree ("school_id","recorded_at");