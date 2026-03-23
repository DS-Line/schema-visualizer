/**
 * Column type sets shared across validation, rendering, and formatting.
 */

export const TEXT_TYPES = new Set([
  "varchar",
  "char",
  "text",
  "string",
  "nvarchar",
  "nchar",
])

export const INT_TYPES = new Set([
  "int",
  "integer",
  "bigint",
  "smallint",
  "tinyint",
  "serial",
  "bigserial",
])

export const FLOAT_TYPES = new Set([
  "float",
  "double",
  "decimal",
  "numeric",
  "real",
  "money",
])

export const UUID_TYPES = new Set(["uuid", "guid", "uniqueidentifier"])

export const DATE_TYPES = new Set([
  "date",
  "datetime",
  "timestamp",
  "time",
  "timestamptz",
  "datetimeoffset",
])

/** Strips type arguments e.g. varchar(255) → varchar */
export const normalizeType = (type: string): string =>
  type
    .replace(/\(.*?\)/g, "")
    .trim()
    .toLowerCase()

/** Returns true if the column type is a text/string type (used to show the selection checkbox). */
export const isTextColumn = (type: string): boolean =>
  TEXT_TYPES.has(normalizeType(type))
