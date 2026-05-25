# PRD: Product Entity

**Date:** 2026-05-25
**Status:** Draft
**Author:** Claude Code

---

## Problem Statement

FLO 360 currently tracks inventory as a single aggregate "boxes" count with no product differentiation. The company is expanding into multiple products, all shipped in boxes. The system must support distinct products so that workers and managers can record, approve, and report on stock movements per product. Without this, the system cannot distinguish what is actually in the warehouse.

## Current State Findings

**Confirmed from codebase:**

- **Single-product assumption is pervasive.** Every entity that records boxes (`inboundForms.boxes`, `outboundForms.boxes`, `stockMovements.boxesDelta`) is a single integer with no product reference.
- **Stock is computed as one number:** `SUM(boxes_delta)` across all `stockMovements` rows. Used in dashboard, outbound approval checks, and adjustment validation.
- **Inbound/outbound forms are single-line.** Each form records one `boxes` integer — there is no line-items concept.
- **Outbound pricing is per-form.** `outboundForms` stores `unitPricePesewas` and `totalPesewas` (generated as `boxes * unit_price_pesewas`). No per-line pricing exists.
- **Invoice PDF** renders a single line item (box count x unit price = total). Generated in `src/lib/invoice-pdf.tsx`.
- **Reports** export movements with a single `boxesDelta` column per row. Generated in `src/lib/reports.ts`.
- **Dashboard** (`src/lib/dashboard.ts`) shows one aggregate stock number.
- **Adjustments** apply a single `boxesDelta` to the aggregate stock.
- **Entities follow a consistent pattern:** UUID or bigserial PK, `isActive` for soft-delete, `createdAt`/`updatedAt` timestamps, Drizzle ORM definitions in `src/db/schema.ts`.
- **All mutations use transactions** with audit log entries.
- **Approval workflow** is two-step: worker submits (pending) -> manager approves/rejects.

**Constraints from current architecture:**

- `stockMovements` is append-only by design (tamper-evident ledger). Existing rows should not be mutated — new columns can be added but existing data must be backfilled, not rewritten.
- `outboundForms.totalPesewas` is a generated column (`boxes * unit_price_pesewas`). This will need to change when totals come from line items.
- The `invoice_seq` sequence and invoice PDF generation are tightly coupled to the single-line outbound form.

## Proposed Solution

Introduce a **Product** entity and convert inbound/outbound forms from single-line to multi-line documents with **form line items**. Stock is tracked per product via a new `productId` foreign key on `stockMovements`. Historical data is migrated to a "Default" product.

### High-level changes:

1. **New `products` table** — name, description, `isActive`, timestamps.
2. **New `inboundFormLines` table** — links an inbound form to N products with per-line box quantities.
3. **New `outboundFormLines` table** — links an outbound form to N products with per-line box quantities and per-line unit pricing.
4. **Add `productId` to `stockMovements`** — every ledger entry is now product-specific.
5. **Remove single-line columns** from forms (`boxes`, `unitPricePesewas`, `totalPesewas`) after migration.
6. **Update stock queries** to be per-product (`SUM(boxes_delta) ... GROUP BY product_id`).
7. **Update all UI surfaces** — forms, approvals, dashboard, reports, invoices, adjustments.

## User Stories

1. **As a manager**, I want to create and manage products (name, description, activate/deactivate, edit), so that the system reflects our actual product catalog.
2. **As a worker**, I want to select one or more products and specify box quantities when submitting an inbound form, so that receiving is recorded accurately per product.
3. **As a worker**, I want to select one or more products with box quantities and unit prices when submitting an outbound form, so that dispatches and invoicing are accurate per product.
4. **As a manager**, I want to see per-product box quantities when approving inbound/outbound forms, so that I can make informed approval decisions.
5. **As a manager**, I want the dashboard to show stock breakdown per product, so that I can see inventory levels at a glance.
6. **As a manager**, I want to record stock adjustments per product, so that damage, recount, or returns are tracked against the correct product.
7. **As a manager**, I want reports filterable by product, so that I can analyze movement history for specific products.
8. **As a user**, I want invoices to list each product as a separate line item with its own quantity, unit price, and subtotal, so that customers receive clear documentation.

## Reuse and Change Surface

### Reuse (as-is)

- **Auth guards** (`requireUser`, `requireManager`): no changes needed.
- **Audit log** (`src/audit.ts`): already accepts arbitrary `payload` JSON — product info added to payloads naturally.
- **Approval workflow pattern**: pending -> approved/rejected status enum, `decidedBy`/`decidedAt` fields. Same flow, just more data per form.
- **Entity CRUD pattern**: customers/suppliers already use `isActive` soft-delete, UUID PK, Zod validation, server actions with `revalidatePath`. Product entity follows the same pattern exactly.
- **`PartyPicker` component**: pattern to replicate for a `ProductPicker` component.
- **Money utilities** (`src/lib/money.ts`): `formatGhs`, `parseGhsToPesewas` reused for per-line pricing.
- **Attachment handling** (`src/lib/attachments.ts`): unchanged.
- **Migration runner** (`scripts/migrate.ts`): used for new migrations.

### Modify

- **`src/db/schema.ts`**: Add `products`, `inboundFormLines`, `outboundFormLines` tables. Add `productId` FK to `stockMovements`. Eventually drop `boxes`/`unitPricePesewas`/`totalPesewas` from forms.
- **`src/lib/stock-ledger.ts`**: `getCurrentStock()` becomes `getCurrentStockByProduct()` returning a map. `recordMovement()` requires `productId`. Add `getStockForProduct(productId)`.
- **`src/lib/inbound-forms.ts`**: Submit/edit functions accept line items array instead of single `boxes`. Approval records one `stockMovement` per line item. Queries join line items.
- **`src/lib/outbound-forms.ts`**: Submit/edit functions accept line items with per-line pricing. Approval checks stock per product inside transaction. Total computed from sum of line subtotals. Invoice number and PDF still generated on approval.
- **`src/lib/adjustments.ts`**: `recordAdjustment()` requires `productId`. Validation checks per-product stock for negative adjustments.
- **`src/lib/dashboard.ts`**: Return per-product stock breakdown instead of single number. Also return aggregate total.
- **`src/lib/reports.ts`**: Add product filter. Include product name in exported rows. Group/subtotal by product.
- **`src/lib/invoice-pdf.tsx`**: Render multiple line items (product name, qty, unit price, subtotal) with a grand total.
- **Inbound form pages** (`src/app/inbound/`): Multi-line form with product picker + quantity per line. Detail view shows line items.
- **Outbound form pages** (`src/app/outbound/`): Multi-line form with product picker + quantity + unit price per line. Detail view shows line items.
- **Approval pages** (`src/app/approvals/`): Show line items in review. Outbound approval shows per-product stock availability.
- **Adjustment pages** (`src/app/adjustments/`): Add product picker. Show per-product stock.
- **Dashboard** (`src/app/page.tsx`): Show per-product stock cards/table instead of single number.
- **Reports page** (`src/app/reports/`): Add product filter dropdown.
- **All server actions** in `src/app/*/actions.ts`: Updated signatures to handle line items.

### Net-new

- **`products` table** and enum/relations in schema.
- **`inboundFormLines` table** — `(id, formId, productId, boxes)`.
- **`outboundFormLines` table** — `(id, formId, productId, boxes, unitPricePesewas, subtotalPesewas)`.
- **`src/lib/products.ts`** — CRUD operations for products (list, create, update, deactivate).
- **`src/app/products/`** — Product management pages (list, create, edit). Manager-only.
- **`ProductPicker` component** — Dropdown to select a product (mirrors `PartyPicker`).
- **`LineItemsEditor` component** — Dynamic form section to add/remove product line items with quantity (and price for outbound).
- **Data migration** — Backfill: create "Default" product, assign it to all existing `stockMovements`, create line items from existing form `boxes` columns.
- **Navigation update** — Add "Products" link to `AppShell` sidebar/nav (manager-only).

## Implementation Decisions

### Data Model

**`products` table:**
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK, `gen_random_uuid()` |
| `name` | text | Required, unique among active products |
| `description` | text | Optional, max 2000 chars |
| `isActive` | boolean | Default true, soft-delete |
| `createdAt` | timestamp | Default `now()` |
| `updatedAt` | timestamp | Default `now()` |

**`inboundFormLines` table:**
| Column | Type | Notes |
|--------|------|-------|
| `id` | bigserial | PK |
| `formId` | bigint | FK to `inboundForms`, ON DELETE CASCADE |
| `productId` | uuid | FK to `products`, ON DELETE RESTRICT |
| `boxes` | integer | CHECK `boxes > 0` |

**`outboundFormLines` table:**
| Column | Type | Notes |
|--------|------|-------|
| `id` | bigserial | PK |
| `formId` | bigint | FK to `outboundForms`, ON DELETE CASCADE |
| `productId` | uuid | FK to `products`, ON DELETE RESTRICT |
| `boxes` | integer | CHECK `boxes > 0` |
| `unitPricePesewas` | integer | CHECK `unit_price_pesewas > 0` |
| `subtotalPesewas` | integer | Generated always: `boxes * unit_price_pesewas` |

**`stockMovements` changes:**
| Column | Type | Notes |
|--------|------|-------|
| `productId` | uuid | FK to `products`, NOT NULL after backfill. Add index on `product_id`. |

- A single form approval now creates **one `stockMovement` row per line item**, each with its own `productId` and `boxesDelta`.

### Stock Query Changes

```sql
-- Per-product stock (dashboard, reports)
SELECT product_id, COALESCE(SUM(boxes_delta), 0) as total
FROM stock_movements
GROUP BY product_id;

-- Single product stock (approval check, adjustment validation)
SELECT COALESCE(SUM(boxes_delta), 0)
FROM stock_movements
WHERE product_id = $1;

-- Aggregate total (backward compat if needed)
SELECT COALESCE(SUM(boxes_delta), 0) FROM stock_movements;
```

### Form Total Calculation

- `outboundForms.totalPesewas` generated column must be dropped (it references removed columns).
- Form-level total is computed at query time: `SUM(outbound_form_lines.subtotal_pesewas) WHERE form_id = $1`.
- Alternatively, store a denormalized `totalPesewas` on the form, updated on submit. This avoids join overhead on list pages. **Decision: store denormalized total on form**, computed from line items at submission time, verified at approval time.

### Validation Rules

- Each form must have at least one line item.
- Each line item must reference an active product.
- No duplicate products within the same form (one line per product).
- Outbound approval: per-product stock check inside transaction — each line item's product must have sufficient stock.
- Adjustment: product must be active, negative delta cannot exceed that product's current stock.

### Auth & Permissions

- **Product CRUD**: manager-only (create, edit, deactivate). Follows same pattern as customer/supplier management.
- **Product visibility**: all roles can see active products (needed for form submission).
- Workers can list products but not create/edit/deactivate.

### Invoice Changes

- Invoice PDF line items table changes from one row to N rows.
- Each row: product name, box quantity, unit price (GHS), subtotal (GHS).
- Footer: grand total (sum of subtotals).
- Invoice number and generation flow unchanged.

## Tooling and Delivery Plan

Recommended execution sequence after PRD approval:

1. **`/prd-to-plan`** — Break this PRD into phased implementation plan with tracer-bullet slices.
2. **Phase 1: Product entity** — Schema, migration, CRUD lib, management pages. Use `/design-api` pattern from customers/suppliers.
3. **Phase 2: Schema changes** — Line item tables, `productId` on stock movements, data migration for existing records.
4. **Phase 3: Inbound flow** — Update inbound form submission, detail view, and approval to use line items.
5. **Phase 4: Outbound flow** — Update outbound form submission, detail view, approval, and invoice PDF.
6. **Phase 5: Adjustments, dashboard, reports** — Per-product adjustments, dashboard breakdown, report filtering.
7. **`/write-tests`** — Test stock calculations, multi-line form submission, approval with per-product stock checks, migration integrity.

## Testing and Observability

### Critical test scenarios

- **Stock accuracy**: submitting a multi-product inbound form and approving it should increase stock for each product independently.
- **Outbound stock check**: approving an outbound form must fail if any single product has insufficient stock, even if aggregate stock is sufficient.
- **No duplicate products per form**: validation rejects forms with the same product on multiple lines.
- **Migration integrity**: after backfill, `SUM(boxes_delta)` per "Default" product must equal the previous aggregate total.
- **Invoice rendering**: PDF correctly lists multiple line items with correct subtotals and grand total.
- **Adjustment per product**: negative adjustment blocked when it would drive that product's stock below zero.
- **Product deactivation**: deactivated products cannot be selected on new forms but existing historical data remains intact.

### Observability

- Audit log entries for product CRUD: `action="product.create"`, `"product.update"`, `"product.deactivate"`.
- Audit log payloads for form actions now include line items array (product IDs, quantities).
- Existing audit patterns are sufficient — no new observability infrastructure needed.

## Rollout and Migration

### Database migration (single migration file)

1. Create `products` table.
2. Insert a "Default" product row with a known UUID.
3. Create `inbound_form_lines` and `outbound_form_lines` tables.
4. Add `product_id` column to `stock_movements` (nullable initially).
5. Backfill `stock_movements.product_id` with the Default product UUID.
6. Set `stock_movements.product_id` to NOT NULL.
7. Backfill `inbound_form_lines`: for each existing `inboundForm`, create one line with `productId=Default`, `boxes=form.boxes`.
8. Backfill `outbound_form_lines`: for each existing `outboundForm`, create one line with `productId=Default`, `boxes=form.boxes`, `unitPricePesewas=form.unitPricePesewas`.
9. Add denormalized `totalPesewas` (integer, nullable) to `outboundForms`. Backfill from existing generated column value.
10. Drop the generated `totalPesewas` column, rename the new one. Drop `boxes` and `unitPricePesewas` from both form tables.

**Risk mitigation**: Steps 1-8 are additive (no data loss). Steps 9-10 drop columns — these should only run after the application code no longer references the old columns. Consider splitting into two migrations: one additive, one destructive (after code deploy).

### Rollout sequence

1. Deploy migration (additive part) + new Product management pages.
2. Deploy updated form submission, approval, dashboard, reports code.
3. Deploy destructive migration (drop old columns) once confirmed stable.
4. Manager creates real products and begins using them on new forms.

## Risks and Open Questions

| Risk / Question | Mitigation |
|-----------------|------------|
| **Migration on large dataset** | `stockMovements` is append-only and could be large. Backfill UPDATE should use batching if table exceeds ~100k rows. Current scale is likely small enough for a single UPDATE. |
| **Concurrent approval race condition** | Already handled — approval checks stock inside a transaction. Now checks per-product, same pattern. |
| **"Default" product cluttering the UI** | Consider allowing manager to rename or deactivate "Default" once real products are set up and no new forms reference it. |
| **Pieces-per-box varies by product?** | Currently hardcoded at 24. If different products have different pieces-per-box, a `piecesPerBox` column could be added to `products`. **Out of scope for now** — can be added later. |
| **Form edit/resubmit with line items** | Rejected forms can be edited. Line items must be fully replaceable on resubmit (delete old lines, insert new ones). |
| **Report performance with joins** | Line item joins on report queries. Mitigated by existing date-range filters and row limits. Add index on `form_id` for line item tables. |

## Out of Scope

- **Product categories or hierarchy** — flat product list for now.
- **Pieces-per-box as a product attribute** — all boxes treated equally regardless of contents.
- **Product images or media** — name and description only.
- **Barcode/SKU codes** — not needed at this stage.
- **Multi-warehouse / location tracking** — single warehouse assumed.
- **Batch/lot tracking** — not required.
- **Product-level pricing defaults** — price is set per line item on each outbound form, not stored on the product itself.
