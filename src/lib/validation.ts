import {
  BOOLEAN_TYPES,
  DATE_TYPES,
  FLOAT_TYPES,
  INT_TYPES,
  normalizeType,
  TEXT_TYPES,
  UUID_TYPES,
} from "./column-utils"
import type { SchemaTable } from "./types"

export interface ValidationResult {
  valid: boolean
  error?: string
  warning?: string
}

/** Returns true if two column types are compatible for a relationship. */
export const areTypesCompatible = (type1: string, type2: string): boolean => {
  const norm1 = normalizeType(type1)
  const norm2 = normalizeType(type2)

  if (norm1 === norm2) return true
  if (INT_TYPES.has(norm1) && INT_TYPES.has(norm2)) return true
  if (FLOAT_TYPES.has(norm1) && FLOAT_TYPES.has(norm2)) return true
  if (TEXT_TYPES.has(norm1) && TEXT_TYPES.has(norm2)) return true
  if (UUID_TYPES.has(norm1) && UUID_TYPES.has(norm2)) return true
  if (DATE_TYPES.has(norm1) && DATE_TYPES.has(norm2)) return true
  if (BOOLEAN_TYPES.has(norm1) && BOOLEAN_TYPES.has(norm2)) return true

  return false
}

/** Validates whether a relationship can be created between two columns. */
export const validateRelationship = (
  tables: SchemaTable[],
  sourceTable: string,
  sourceCol: string,
  targetTable: string,
  targetCol: string,
): ValidationResult => {
  if (sourceTable === targetTable) {
    return {
      valid: false,
      error: "A table cannot have a relationship with itself",
    }
  }

  const srcTable = tables.find((t) => t.name === sourceTable)
  const tgtTable = tables.find((t) => t.name === targetTable)

  if (!srcTable)
    return { valid: false, error: `Table "${sourceTable}" not found` }
  if (!tgtTable)
    return { valid: false, error: `Table "${targetTable}" not found` }

  const srcColumn = srcTable.columns.find((c) => c.name === sourceCol)
  const tgtColumn = tgtTable.columns.find((c) => c.name === targetCol)

  if (!srcColumn) {
    return {
      valid: false,
      error: `Column "${sourceCol}" not found in table "${sourceTable}"`,
    }
  }
  if (!tgtColumn) {
    return {
      valid: false,
      error: `Column "${targetCol}" not found in table "${targetTable}"`,
    }
  }

  if (!areTypesCompatible(srcColumn.type, tgtColumn.type)) {
    return {
      valid: false,
      error: `Incompatible types: ${srcColumn.type} and ${tgtColumn.type}`,
    }
  }

  return { valid: true }
}
