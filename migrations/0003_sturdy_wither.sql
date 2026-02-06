CREATE TABLE "certificate_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" varchar(255) DEFAULT 'Certificate of Completion' NOT NULL,
	"subtitle" varchar(255) DEFAULT 'This is to certify that',
	"description" text DEFAULT 'has successfully completed the course',
	"signature_text" varchar(255),
	"signature_image" text,
	"logo_url" text,
	"background_url" text,
	"primary_color" varchar(20) DEFAULT '#4f0099',
	"secondary_color" varchar(20) DEFAULT '#22ad5c',
	"settings" jsonb DEFAULT '{"layout":"classic","orientation":"landscape","showDate":true,"showCourseHours":true,"showInstructorName":true,"showCredentialId":true,"borderStyle":"elegant"}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issued_certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credential_id" varchar(50) NOT NULL,
	"template_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"student_name" varchar(255) NOT NULL,
	"course_name" varchar(255) NOT NULL,
	"instructor_name" varchar(255),
	"course_hours" integer,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"revoked_at" timestamp,
	"revoked_reason" text,
	"download_count" integer DEFAULT 0 NOT NULL,
	"last_downloaded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "issued_certificates_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
ALTER TABLE "certificate_templates" ADD CONSTRAINT "certificate_templates_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_certificates" ADD CONSTRAINT "issued_certificates_template_id_certificate_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."certificate_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_certificates" ADD CONSTRAINT "issued_certificates_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_certificates" ADD CONSTRAINT "issued_certificates_student_id_app_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "certificate_templates_course_idx" ON "certificate_templates" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "certificate_templates_course_unique" ON "certificate_templates" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "issued_certificates_credential_idx" ON "issued_certificates" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "issued_certificates_student_idx" ON "issued_certificates" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "issued_certificates_course_idx" ON "issued_certificates" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "issued_certificates_template_idx" ON "issued_certificates" USING btree ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "issued_certificates_student_course_unique" ON "issued_certificates" USING btree ("student_id","course_id");