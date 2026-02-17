import type { SchemaTable } from "./types"

/**
 * Checks if two column types are compatible for a relationship
 */
export const areTypesCompatible = (type1: string, type2: string): boolean => {
  // Normalize types (remove size/precision info)
  const normalize = (type: string): string => {
    return type
      .replace(/\(.*?\)/g, "")
      .trim()
      .toLowerCase()
  }

  const norm1 = normalize(type1)
  const norm2 = normalize(type2)

  // Exact match
  if (norm1 === norm2) return true

  // Integer type compatibility
  const intTypes = new Set([
    "int",
    "integer",
    "bigint",
    "smallint",
    "tinyint",
    "serial",
    "bigserial",
  ])

  if (intTypes.has(norm1) && intTypes.has(norm2)) return true

  // String type compatibility
  const stringTypes = new Set([
    "varchar",
    "char",
    "text",
    "string",
    "nvarchar",
    "nchar",
  ])

  if (stringTypes.has(norm1) && stringTypes.has(norm2)) return true

  // Float/decimal compatibility
  const floatTypes = new Set([
    "float",
    "double",
    "decimal",
    "numeric",
    "real",
    "money",
  ])

  if (floatTypes.has(norm1) && floatTypes.has(norm2)) return true

  // UUID compatibility
  const uuidTypes = new Set(["uuid", "guid", "uniqueidentifier"])
  if (uuidTypes.has(norm1) && uuidTypes.has(norm2)) return true

  // Date/time compatibility
  const dateTypes = new Set([
    "date",
    "datetime",
    "timestamp",
    "time",
    "timestamptz",
    "datetimeoffset",
  ])

  if (dateTypes.has(norm1) && dateTypes.has(norm2)) return true

  return false
}

/**
 * Validates if a relationship can be created between two columns
 */
export interface ValidationResult {
  valid: boolean
  error?: string
  warning?: string
}

export const validateRelationship = (
  tables: SchemaTable[],
  sourceTable: string,
  sourceCol: string,
  targetTable: string,
  targetCol: string,
): ValidationResult => {
  // Prevent self-referencing relationships
  if (sourceTable === targetTable) {
    return {
      valid: false,
      error: "A table cannot have a relationship with itself",
    }
  }

  // Find tables
  const srcTable = tables.find((t) => t.name === sourceTable)
  const tgtTable = tables.find((t) => t.name === targetTable)

  if (!srcTable) {
    return { valid: false, error: `Table "${sourceTable}" not found` }
  }

  if (!tgtTable) {
    return { valid: false, error: `Table "${targetTable}" not found` }
  }

  // Find columns
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

  // Check if types are compatible
  if (!areTypesCompatible(srcColumn.type, tgtColumn.type)) {
    return {
      valid: false,
      error: `Incompatible types: ${srcColumn.type} and ${tgtColumn.type}`,
    }
  }

  // All checks passed
  return { valid: true }
}
