CREATE TABLE IF NOT EXISTS "outbound_forms" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"customer_id" uuid NOT NULL,
	"boxes" integer NOT NULL,
	"unit_price_pesewas" integer NOT NULL,
	"total_pesewas" integer GENERATED ALWAYS AS ((boxes * unit_price_pesewas)) STORED,
	"dispatch_date" date NOT NULL,
	"note" text,
	"status" "form_status" DEFAULT 'pending' NOT NULL,
	"decision_reason" text,
	"invoice_number" bigint,
	"invoice_pdf_key" text,
	"created_by" uuid NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbound_forms_invoice_number_unique" UNIQUE("invoice_number"),
	CONSTRAINT "outbound_forms_boxes_positive" CHECK ("outbound_forms"."boxes" > 0),
	CONSTRAINT "outbound_forms_unit_price_positive" CHECK ("outbound_forms"."unit_price_pesewas" > 0)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outbound_forms" ADD CONSTRAINT "outbound_forms_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outbound_forms" ADD CONSTRAINT "outbound_forms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outbound_forms" ADD CONSTRAINT "outbound_forms_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbound_forms_status_created_at_idx" ON "outbound_forms" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbound_forms_created_by_idx" ON "outbound_forms" USING btree ("created_by");--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "invoice_seq" AS bigint INCREMENT BY 1 START WITH 1 MINVALUE 1 NO MAXVALUE CACHE 1;