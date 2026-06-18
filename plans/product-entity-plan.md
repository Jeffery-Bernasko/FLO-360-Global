# Plan: Product Entity

> Source PRD: `plans/product-entity-prd.md`

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: `/products` (list), `/products/new` (create), `/products/[id]` (edit) — manager-only. No new routes for inbound/outbound/adjustments/reports — existing routes gain product awareness.
- **Schema**: New tables `products`, `inbound_form_lines`, `outbound_form_lines`. New column `product_id` on `stock_movements`. Denormalized `total_pesewas` on `outbound_forms` (replaces generated column).
- **Key models**: `Product` (uuid PK, name, description, isActive). `InboundFormLine` (formId, productId, boxes). `OutboundFormLine` (formId, productId, boxes, unitPricePesewas, subtotalPesewas generated).
- **Auth**: Product CRUD is manager-only. Product listing (active only) is available to all authenticated users.
- **Migration strategy**: "Default" product created during migration. All historical `stockMovements` backfilled to Default. Line items backfilled from existing form `boxes`/`unitPricePesewas` columns. Column drops happen in a separate final phase.
- **Validation**: At least one line item per form. No duplicate products within a form. Per-product stock check on outbound approval. Active product required for new line items.

---

## Phase 1: Product Entity CRUD

**User stories**: #1 (manager creates/manages products)

### What to build

A complete product management surface. Manager can create products with a name and description, edit existing products, and deactivate products (soft-delete). All authenticated users can view the list of active products. A "Products" link appears in the navigation for managers. Follows the same patterns as customer/supplier management.

### Acceptance criteria

- [ ] `products` table exists with `id` (uuid), `name`, `description`, `isActive`, `createdAt`, `updatedAt`
- [ ] Manager can create a product with name (required) and description (optional)
- [ ] Manager can edit a product's name and description
- [ ] Manager can deactivate a product; deactivated products do not appear in active product lists
- [ ] Workers cannot access product management pages (manager-only guard)
- [ ] "Products" link visible in navigation for managers
- [ ] Audit log entries emitted for product create, update, and deactivate actions
- [ ] Product name is unique among active products

---

## Phase 2: Multi-Product Inbound Flow

**User stories**: #2 (worker selects products on inbound), #4 (manager sees per-product quantities on approval)

### What to build

Data migration foundation plus the full multi-product inbound flow. First, migrate existing data: create "Default" product, add `product_id` to `stock_movements` (backfilled to Default), create `inbound_form_lines` table and backfill from existing inbound form `boxes` columns. Then update the inbound submission form to accept multiple line items (product picker + box quantity per line), update the inbound detail view to display line items, and update the inbound approval flow to create one stock movement per line item. Stock is now tracked per product.

### Acceptance criteria

- [ ] "Default" product exists in `products` table after migration
- [ ] All existing `stock_movements` rows have `product_id` set to the Default product
- [ ] `inbound_form_lines` table exists and is backfilled from existing inbound forms
- [ ] `product_id` column on `stock_movements` is NOT NULL
- [ ] `SUM(boxes_delta)` grouped by Default product equals the previous aggregate total (migration integrity)
- [ ] Worker can submit an inbound form with one or more product line items (product + box quantity)
- [ ] Validation rejects forms with zero line items or duplicate products
- [ ] Validation rejects line items referencing inactive products
- [ ] Inbound detail view displays line items with product name and box quantity
- [ ] Manager approval view shows per-product quantities
- [ ] Approving an inbound form creates one `stockMovement` per line item with correct `productId`
- [ ] Editing and resubmitting a rejected inbound form replaces all line items
- [ ] Audit log payloads include line item details

---

## Phase 3: Multi-Product Outbound Flow & Invoicing

**User stories**: #3 (worker selects products with pricing on outbound), #4 (manager sees per-product quantities on approval), #8 (invoices list product line items)

### What to build

Create `outbound_form_lines` table and backfill from existing outbound forms. Update outbound submission to accept multiple line items with per-line product, box quantity, and unit price. Add denormalized `totalPesewas` to `outbound_forms` computed from line item subtotals. Update outbound approval to check per-product stock sufficiency inside the transaction — if any single product has insufficient stock, the entire form is rejected. Update invoice PDF to render multiple line items (product name, qty, unit price, subtotal) with a grand total. Update outbound detail and approval views.

### Acceptance criteria

- [ ] `outbound_form_lines` table exists and is backfilled from existing outbound forms
- [ ] Worker can submit an outbound form with one or more product line items (product + boxes + unit price)
- [ ] Form-level total is computed from sum of line item subtotals and stored on the form
- [ ] Validation rejects forms with zero line items, duplicate products, or inactive products
- [ ] Outbound approval checks per-product stock — fails if any product has insufficient stock
- [ ] Approving an outbound form creates one `stockMovement` per line item with negative `boxesDelta`
- [ ] Invoice PDF renders each product as a separate line item with quantity, unit price, and subtotal
- [ ] Invoice PDF shows grand total as sum of all line subtotals
- [ ] Outbound detail view displays line items with product, quantity, unit price, and subtotal
- [ ] Manager approval view shows per-product stock availability alongside requested quantities
- [ ] Editing and resubmitting a rejected outbound form replaces all line items
- [ ] Audit log payloads include line item details

---

## Phase 4: Per-Product Adjustments, Dashboard & Reports

**User stories**: #5 (dashboard shows per-product stock), #6 (adjustments per product), #7 (reports filterable by product)

### What to build

Update stock adjustments to require a product selection — manager picks a product and enters a box delta, with validation ensuring negative adjustments don't exceed that product's stock. Update the dashboard to show a per-product stock breakdown (table or card list) alongside an aggregate total. Update reports to include a product filter dropdown and add product name to exported rows (CSV and PDF). Update report grouping/subtotals to reflect per-product data.

### Acceptance criteria

- [ ] Adjustment form includes a product picker (required)
- [ ] Negative adjustments are blocked when they would drive that product's stock below zero
- [ ] Adjustment creates a `stockMovement` with the selected `productId`
- [ ] Dashboard displays per-product stock breakdown (product name + box count)
- [ ] Dashboard also shows aggregate total stock across all products
- [ ] Reports page includes a product filter dropdown
- [ ] Exported CSV includes a product name column
- [ ] Exported PDF includes product name in movement rows
- [ ] Adjustment list view shows product name for each adjustment
- [ ] Audit log entries for adjustments include product ID

---

## Phase 5: Drop Legacy Columns

**User stories**: Cleanup — no user-facing behavior change

### What to build

Destructive migration to remove columns that are no longer referenced by application code. Drop `boxes` from `inbound_forms`, drop `boxes`, `unit_price_pesewas`, and the old generated `total_pesewas` from `outbound_forms`. Only run after Phases 1-4 are deployed and confirmed stable.

### Acceptance criteria

- [ ] `inbound_forms.boxes` column is dropped
- [ ] `outbound_forms.boxes`, `outbound_forms.unit_price_pesewas`, and old `outbound_forms.total_pesewas` columns are dropped
- [ ] Application functions correctly without the removed columns
- [ ] No references to removed columns remain in application code
- [ ] Migration is tested against a copy of production data before deployment
