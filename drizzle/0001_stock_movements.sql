CREATE TYPE "public"."movement_kind" AS ENUM('inbound', 'outbound', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."source_form_kind" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_movements" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kind" "movement_kind" NOT NULL,
	"boxes_delta" integer NOT NULL,
	"reason" text,
	"source_form_kind" "source_form_kind",
	"source_form_id" bigint,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_created_at_idx" ON "stock_movements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_source_idx" ON "stock_movements" USING btree ("source_form_kind","source_form_id");