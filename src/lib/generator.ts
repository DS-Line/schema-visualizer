import type { SchemaRef } from "./types"

/**
 * Generates DBML code by replacing refs in the original schema
 * Keeps everything else (tables, columns, settings) unchanged
 */
export const generateDBMLFromRefs = (
  originalDBML: string,
  refs: SchemaRef[],
): string => {
  // Remove all existing Ref lines
  const withoutRefs = originalDBML.replace(/^\s*Ref:.*$/gm, "").trim()

  // Clean up multiple consecutive blank lines
  const cleaned = withoutRefs.replace(/\n\n\n+/g, "\n\n")

  // Generate new Ref lines
  const refLines = refs
    .map(
      (ref) =>
        `Ref: ${ref.fromTable}.${ref.fromCol} ${ref.relationType} ${ref.toTable}.${ref.toCol}`,
    )
    .join("\n")

  // Append refs at the end (if any exist)
  if (refLines.length > 0) {
    return `${cleaned}\n\n${refLines}\n`
  }

  return cleaned
}
