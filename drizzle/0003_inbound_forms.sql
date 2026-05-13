CREATE TYPE "public"."form_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inbound_forms" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"supplier_id" uuid NOT NULL,
	"boxes" integer NOT NULL,
	"received_date" date NOT NULL,
	"note" text,
	"attachment_key" text,
	"status" "form_status" DEFAULT 'pending' NOT NULL,
	"decision_reason" text,
	"created_by" uuid NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbound_forms_boxes_positive" CHECK ("inbound_forms"."boxes" > 0)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inbound_forms" ADD CONSTRAINT "inbound_forms_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inbound_forms" ADD CONSTRAINT "inbound_forms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inbound_forms" ADD CONSTRAINT "inbound_forms_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbound_forms_status_created_at_idx" ON "inbound_forms" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbound_forms_created_by_idx" ON "inbound_forms" USING btree ("created_by");