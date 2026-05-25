CREATE TABLE IF NOT EXISTS "outbound_form_lines" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"form_id" bigint NOT NULL,
	"product_id" uuid NOT NULL,
	"boxes" integer NOT NULL,
	"unit_price_pesewas" integer NOT NULL,
	CONSTRAINT "outbound_form_lines_boxes_positive" CHECK ("outbound_form_lines"."boxes" > 0),
	CONSTRAINT "outbound_form_lines_unit_price_positive" CHECK ("outbound_form_lines"."unit_price_pesewas" > 0)
);
--> statement-breakpoint
-- Backfill outbound_form_lines from existing outbound_forms using Default product.
INSERT INTO "outbound_form_lines" ("form_id", "product_id", "boxes", "unit_price_pesewas")
SELECT "id", '00000000-0000-4000-a000-000000000001', "boxes", "unit_price_pesewas"
FROM "outbound_forms";
--> statement-breakpoint
-- Convert total_pesewas from a generated column to a regular stored column.
-- Step 1: Drop the generated column.
ALTER TABLE "outbound_forms" DROP COLUMN "total_pesewas";
--> statement-breakpoint
-- Step 2: Re-add as a regular integer column (nullable first for backfill).
ALTER TABLE "outbound_forms" ADD COLUMN "total_pesewas" integer;
--> statement-breakpoint
-- Step 3: Backfill from existing boxes * unit_price_pesewas.
UPDATE "outbound_forms" SET "total_pesewas" = "boxes" * "unit_price_pesewas" WHERE "total_pesewas" IS NULL;
--> statement-breakpoint
-- Step 4: Set NOT NULL.
ALTER TABLE "outbound_forms" ALTER COLUMN "total_pesewas" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outbound_form_lines" ADD CONSTRAINT "outbound_form_lines_form_id_outbound_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."outbound_forms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outbound_form_lines" ADD CONSTRAINT "outbound_form_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbound_form_lines_form_id_idx" ON "outbound_form_lines" USING btree ("form_id");
