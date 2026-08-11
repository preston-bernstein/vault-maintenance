/**
 * Error and date formatting helpers shared across the pipeline.
 */

export function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** True if value is a valid Date (not invalid, not NaN). */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

/** YYYY-MM-DD for a Date; fallback to today if invalid. */
export function toISODateString(date: unknown): string {
  const d = isValidDate(date) ? date : new Date();
  return d.toISOString().slice(0, 10);
}
