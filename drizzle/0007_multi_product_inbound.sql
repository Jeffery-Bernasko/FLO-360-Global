-- Insert the well-known "Default" product for historical data backfill.
INSERT INTO "products" ("id", "name", "description", "is_active", "created_at", "updated_at")
VALUES ('00000000-0000-4000-a000-000000000001', 'Default', 'Legacy product for historical data', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inbound_form_lines" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"form_id" bigint NOT NULL,
	"product_id" uuid NOT NULL,
	"boxes" integer NOT NULL,
	CONSTRAINT "inbound_form_lines_boxes_positive" CHECK ("inbound_form_lines"."boxes" > 0)
);
--> statement-breakpoint
-- Add product_id as nullable first, backfill, then set NOT NULL.
ALTER TABLE "stock_movements" ADD COLUMN "product_id" uuid;
--> statement-breakpoint
UPDATE "stock_movements" SET "product_id" = '00000000-0000-4000-a000-000000000001' WHERE "product_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "stock_movements" ALTER COLUMN "product_id" SET NOT NULL;
--> statement-breakpoint
-- Backfill inbound_form_lines from existing inbound_forms.
INSERT INTO "inbound_form_lines" ("form_id", "product_id", "boxes")
SELECT "id", '00000000-0000-4000-a000-000000000001', "boxes"
FROM "inbound_forms";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inbound_form_lines" ADD CONSTRAINT "inbound_form_lines_form_id_inbound_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."inbound_forms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inbound_form_lines" ADD CONSTRAINT "inbound_form_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbound_form_lines_form_id_idx" ON "inbound_form_lines" USING btree ("form_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_product_id_idx" ON "stock_movements" USING btree ("product_id");
