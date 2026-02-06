DROP INDEX "assignment_submissions_user_assignment_idx";--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "email" varchar(255);--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
CREATE INDEX "assignment_submissions_assignment_idx" ON "assignment_submissions" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "assignment_submissions_submitted_at_idx" ON "assignment_submissions" USING btree ("submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "assignment_submissions_user_assignment_idx" ON "assignment_submissions" USING btree ("app_user_id","assignment_id");