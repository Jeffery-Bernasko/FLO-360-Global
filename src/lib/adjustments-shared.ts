/**
 * Client-safe constants for the adjustments feature. The main
 * `@/lib/adjustments` module imports the DB; this file does not, so it can
 * be imported from client components.
 */
export const ADJUSTMENT_REASONS = [
  "Damaged",
  "Returned",
  "Recount",
  "Other",
] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];
