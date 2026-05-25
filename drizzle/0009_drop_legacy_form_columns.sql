-- Phase 5: Drop legacy single-product columns from inbound_forms and outbound_forms.
-- These are no longer referenced by application code; all data now comes from
-- inbound_form_lines and outbound_form_lines.

-- 1. Drop check constraints first.
ALTER TABLE "inbound_forms" DROP CONSTRAINT IF EXISTS "inbound_forms_boxes_positive";
ALTER TABLE "outbound_forms" DROP CONSTRAINT IF EXISTS "outbound_forms_boxes_positive";
ALTER TABLE "outbound_forms" DROP CONSTRAINT IF EXISTS "outbound_forms_unit_price_positive";

-- 2. Drop columns.
ALTER TABLE "inbound_forms" DROP COLUMN IF EXISTS "boxes";
ALTER TABLE "outbound_forms" DROP COLUMN IF EXISTS "boxes";
ALTER TABLE "outbound_forms" DROP COLUMN IF EXISTS "unit_price_pesewas";
ALTER TABLE "outbound_forms" DROP COLUMN IF EXISTS "total_pesewas";
