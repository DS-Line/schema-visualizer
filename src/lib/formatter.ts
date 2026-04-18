import type { SchemaCol, SchemaRef, SchemaTable } from "./types"

// ─── Identifier quoting ───────────────────────────────────────────────────────

/**
 * Wraps an identifier in double-quotes if it contains characters that are not
 * safe as a bare DBML identifier (anything outside word chars: a-z, A-Z, 0-9, _).
 */
const quoteIdentifier = (name: string): string =>
  /^[a-zA-Z_]\w*$/.test(name) ? name : `"${name}"`

/**
 * Wraps a column type in double-quotes if the base name contains characters
 * that are not safe as a bare DBML type name (anything outside letters, digits,
 * underscores, and spaces).  Spaces are intentionally allowed so that
 * multi-word SQL types such as "character varying" or "timestamp with time
 * zone" are left unquoted; only types with hyphens, dots, slashes, or other
 * punctuation (e.g. "USER-DEFINED", "my.type") get quoted.
 *
 * The args portion "(n,m)" is preserved verbatim and never quoted.
 */
const quoteType = (type: string): string => {
  const parenIdx = type.indexOf("(")
  if (parenIdx === -1) {
    return /^[a-zA-Z_][a-zA-Z0-9_ ]*$/.test(type) ? type : `"${type}"`
  }
  const baseName = type.slice(0, parenIdx)
  const args = type.slice(parenIdx)
  const quotedBase = /^[a-zA-Z_][a-zA-Z0-9_ ]*$/.test(baseName)
    ? baseName
    : `"${baseName}"`
  return `${quotedBase}${args}`
}

// ─── Constraint helpers ───────────────────────────────────────────────────────

/**
 * Normalises and orders column constraints into a canonical string.
 * Order: pk → increment → unique → not null → default
 */
const formatConstraints = (col: SchemaCol): string => {
  const parts: string[] = []

  if (col.isPk) parts.push("pk")
  if (col.not_null && !col.isPk) parts.push("not null")
  if (col.unique && !col.isPk) parts.push("unique")

  return parts.length > 0 ? `[${parts.join(", ")}]` : ""
}

// ─── Table formatter ──────────────────────────────────────────────────────────

/**
 * Formats a single table block with aligned columns.
 *
 * Example output:
 *
 *   Table users {
 *     id         int       [pk]
 *     name       varchar   [not null]
 *     created_at timestamp
 *   }
 */
const formatTable = (table: SchemaTable): string => {
  if (table.columns.length === 0) {
    return `Table ${quoteIdentifier(table.name)} {\n}`
  }

  // Pre-compute quoted forms so widths and output use the same strings.
  const quoted = table.columns.map((col) => ({
    col,
    name: quoteIdentifier(col.name),
    type: quoteType(col.type),
  }))

  const nameWidth = Math.max(...quoted.map((q) => q.name.length))
  const typeWidth = Math.max(...quoted.map((q) => q.type.length))

  const rows = quoted.map(({ col, name, type }) => {
    const paddedName = name.padEnd(nameWidth)
    const paddedType = type.padEnd(typeWidth)
    const constraints = formatConstraints(col)

    // Only include the constraint block if there are constraints
    const line = constraints
      ? `  ${paddedName}  ${paddedType}  ${constraints}`
      : `  ${paddedName}  ${paddedType}`

    // Trim trailing spaces on lines without constraints
    return line.trimEnd()
  })

  return `Table ${quoteIdentifier(table.name)} {\n${rows.join("\n")}\n}`
}

// ─── Ref formatter ────────────────────────────────────────────────────────────

const formatRef = (ref: SchemaRef): string =>
  `Ref: ${quoteIdentifier(ref.fromTable)}.${quoteIdentifier(ref.fromCol)} ${ref.relationType} ${quoteIdentifier(ref.toTable)}.${quoteIdentifier(ref.toCol)}`

// ─── Main formatter ───────────────────────────────────────────────────────────

/**
 * Produces a fully formatted DBML string from parsed schema data.
 * - Column names and types are padded per-table to align
 * - Constraints are normalised and ordered consistently
 * - Tables are separated by a single blank line
 * - Refs are grouped at the end, separated from tables by a blank line
 */
export const formatDBML = (
  tables: SchemaTable[],
  refs: SchemaRef[],
): string => {
  const parts: string[] = []

  if (tables.length > 0) {
    parts.push(tables.map(formatTable).join("\n\n"))
  }

  if (refs.length > 0) {
    parts.push(refs.map(formatRef).join("\n"))
  }

  return `${parts.join("\n\n")}\n`
}
