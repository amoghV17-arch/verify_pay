import type { activity } from '../db/schema.js';

export type ActivityRow = typeof activity.$inferSelect;

export interface FormattedActivityRecord extends ActivityRow {
  timestamp: string;
  description: string;
  type: string;
  metadata: Record<string, unknown> | null;
}

/**
 * Normalizes DB activity rows so both canonical DB keys (ts, kind, text, meta)
 * and UI keys (timestamp, type, description, metadata) are always present.
 */
export function formatActivityRecord(row: ActivityRow): FormattedActivityRecord {
  const timestamp =
    row.ts instanceof Date ? row.ts.toISOString() : String(row.ts ?? new Date().toISOString());
  const metadata =
    row.meta && typeof row.meta === 'object' ? (row.meta as Record<string, unknown>) : null;

  return {
    ...row,
    timestamp,
    description: row.text,
    type: row.kind,
    metadata,
  };
}

