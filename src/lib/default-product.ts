/**
 * Well-known UUID for the "Default" product created during the Phase 2
 * data migration. All historical stock movements and form line items
 * that pre-date multi-product support reference this product.
 *
 * Outbound forms and adjustments use this until they are updated to
 * support per-product selection (Phase 3 and Phase 4).
 */
export const DEFAULT_PRODUCT_ID = "00000000-0000-4000-a000-000000000001";
