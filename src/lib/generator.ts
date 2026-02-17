import { formatDBML } from "./formatter"
import type { SchemaRef, SchemaTable } from "./types"

/**
 * Generates formatted DBML from parsed tables and live refs.
 * Delegates all formatting to formatDBML so the output is always
 * consistently aligned regardless of what the backend originally sent.
 */
export const generateDBMLFromRefs = (
  tables: SchemaTable[],
  refs: SchemaRef[],
): string => formatDBML(tables, refs)
