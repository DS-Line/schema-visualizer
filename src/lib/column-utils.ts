/**
 * Column type sets shared across validation, rendering, and formatting.
 */

export const TEXT_TYPES = new Set([
  // Standard SQL
  "varchar", "char", "character", "text", "string",
  // Oracle
  "varchar2", "nvarchar2", "clob", "nclob",
  // SQL Server / MySQL
  "nvarchar", "nchar", "tinytext", "mediumtext", "longtext",
  // PostgreSQL
  "bpchar", "citext",
])

export const INT_TYPES = new Set([
  // Standard
  "int", "integer", "bigint", "smallint", "tinyint", "mediumint",
  // PostgreSQL serial types
  "serial", "bigserial", "smallserial",
  // PostgreSQL aliases
  "int2", "int4", "int8",
  // Snowflake
  "byteint",
])

export const FLOAT_TYPES = new Set([
  // Standard
  "float", "double", "decimal", "numeric", "real",
  // PostgreSQL aliases
  "float4", "float8",
  // SQL Server
  "money", "smallmoney",
  // Oracle (NUMBER covers both int and float precision)
  "number",
])

export const UUID_TYPES = new Set([
  "uuid", "guid", "uniqueidentifier",
])

export const DATE_TYPES = new Set([
  // Standard
  "date", "datetime", "timestamp", "time",
  // PostgreSQL
  "timestamptz", "timetz", "interval",
  // SQL Server
  "datetime2", "smalldatetime", "datetimeoffset",
  // MySQL
  "year",
])

export const BOOLEAN_TYPES = new Set([
  "boolean", "bool", "bit",
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
