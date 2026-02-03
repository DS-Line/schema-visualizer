import type {
  SchemaCol,
  SchemaData,
  SchemaError,
  SchemaRef,
  SchemaTable,
} from "./types"

// Convert character index to Line/Column
const getLinePos = (text: string, index: number) => {
  const substring = text.substring(0, index)
  const lines = substring.split("\n")
  const line = lines.length
  const col = lines[lines.length - 1].length + 1
  return { line, col }
}

const checkTypeCompatibility = (typeA: string, typeB: string): boolean => {
  const t1 = typeA.toUpperCase().trim()
  const t2 = typeB.toUpperCase().trim()

  // Exact Match or Empty (Unknown types from views often empty)
  if (t1 === t2 || t1 === "" || t2 === "") return true

  const numberTypes = new Set([
    "NUMBER",
    "INT",
    "INTEGER",
    "BIGINT",
    "SMALLINT",
    "TINYINT",
    "DECIMAL",
    "NUMERIC",
    "FLOAT",
    "REAL",
    "DOUBLE",
    "BIT",
    "MONEY",
  ])
  if (numberTypes.has(t1) && numberTypes.has(t2)) return true

  const stringTypes = new Set([
    "VARCHAR",
    "TEXT",
    "CHAR",
    "STRING",
    "NVARCHAR",
    "NCHAR",
    "CLOB",
    "XML",
    "UNIQUEIDENTIFIER",
  ])
  if (stringTypes.has(t1) && stringTypes.has(t2)) return true

  const dateTypes = new Set([
    "DATE",
    "TIMESTAMP",
    "DATETIME",
    "TIME",
    "DATETIME2",
    "SMALLDATETIME",
    "DATETIMEOFFSET",
  ])
  if (dateTypes.has(t1) && dateTypes.has(t2)) return true

  return false
}

const parseColumns = (body: string): SchemaCol[] => {
  return body
    .split(/,(?![^(]*\))/)
    .map((colStr): SchemaCol | null => {
      const parts = colStr.trim().split(/\s+/)
      const first = parts[0]?.toUpperCase()
      // Added check for bracketed identifiers due to fabric's ddl formatting
      if (
        !first ||
        (/^(PRIMARY|CONSTRAINT|FOREIGN|KEY|UNIQUE|CHECK|INDEX)/.test(first) &&
          !first.startsWith("["))
      )
        return null

      // Clean brackets [ ] in addition to quotes
      const name = parts[0].replace(/["`[\]]/g, "")

      // Extract base type ignoring arguments e.g. VARCHAR(255) -> VARCHAR
      const type =
        parts
          .slice(1)
          .join(" ")
          .match(/^[A-Z0-9_]+/i)?.[0] ?? ""

      const isPk = /PRIMARY KEY/i.test(colStr)

      return { name, type, isPk, isFk: false }
    })
    .filter((c): c is SchemaCol => c !== null)
}

const parseSelectColumns = (query: string): SchemaCol[] => {
  const selectMatch = /SELECT\s+([\s\S]+?)\s+FROM/i.exec(query)
  if (!selectMatch) return []

  return selectMatch[1]
    .split(",")
    .map((col) => {
      let clean = col.trim()
      const asMatch = /(.+)\s+AS\s+(.+)/i.exec(clean)
      if (asMatch)
        return {
          // Clean brackets from alias
          name: asMatch[2].trim().replace(/["`[\]]/g, ""),
          type: "", // Views often have unknown types in Regex parsing
          isPk: false,
          isFk: false,
        }

      const dotIndex = clean.lastIndexOf(".")
      if (dotIndex > -1) clean = clean.substring(dotIndex + 1)

      const spaceParts = clean.split(/\s+/)
      if (spaceParts.length > 1 && !clean.includes("("))
        clean = spaceParts[spaceParts.length - 1]

      return {
        // Clean brackets from column name
        name: clean.replace(/["`[\]]/g, ""),
        type: "",
        isPk: false,
        isFk: false,
      }
    })
    .filter((c) => c.name && c.name !== "*" && !c.name.includes(" "))
}

// Check if a line index is inside a CREATE VIEW statement
const isInsideCreateView = (lines: string[], lineIdx: number): boolean => {
  let insideView = false

  // Look backwards to find if we're in a CREATE VIEW block
  for (let i = lineIdx; i >= 0; i--) {
    const trimmed = lines[i].trim()
    if (!trimmed || trimmed.startsWith("--")) continue

    // If we hit a semicolon before finding CREATE VIEW, we're not in one
    if (trimmed.endsWith(";") && i < lineIdx) {
      return false
    }

    // Found CREATE VIEW
    if (/^CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+/i.test(trimmed)) {
      insideView = true
      break
    }

    // If we hit another CREATE or ALTER statement, we're not in a view
    if (/^(CREATE\s+TABLE|ALTER\s+TABLE)\s+/i.test(trimmed)) {
      return false
    }
  }

  if (!insideView) return false

  // Now check forward to make sure we haven't ended the view yet
  for (let i = lineIdx; i >= 0; i--) {
    const trimmed = lines[i].trim()
    if (!trimmed || trimmed.startsWith("--")) continue

    if (/^CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+/i.test(trimmed)) {
      // Found the start, now check if current line is before the end
      for (let j = i; j < lines.length; j++) {
        const checkLine = lines[j].trim()
        if (checkLine.endsWith(";")) {
          // View ends at line j
          return lineIdx <= j
        }
      }
      // No semicolon found, view extends to end
      return true
    }
  }

  return false
}

// Validate SQL DDL syntax
const validateSyntax = (text: string, errors: SchemaError[]) => {
  const lines = text.split("\n")

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("--") || trimmed.startsWith("/*"))
      continue

    // Check for statements starting with CREATE
    if (/^CREATE\s+/i.test(trimmed)) {
      // Must be CREATE TABLE or CREATE VIEW
      if (!/^CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)\s+/i.test(trimmed)) {
        const createMatch = /^(CREATE\s+\w*)/i.exec(trimmed)
        if (createMatch) {
          errors.push({
            message: "Invalid CREATE statement.",
            startLineNumber: i + 1,
            startColumn: 1,
            endLineNumber: i + 1,
            endColumn: createMatch[0].length + 1,
          })
        }
        continue
      }

      // Check for missing table/view name
      const nameMatch =
        /^CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:\[[^\]]+\]|\w+)\.)?(?:\[([^\]]+)\]|(\w+))/i.exec(
          trimmed,
        )
      if (!nameMatch || (!nameMatch[1] && !nameMatch[2])) {
        errors.push({
          message: "Missing table or view name after CREATE",
          startLineNumber: i + 1,
          startColumn: 1,
          endLineNumber: i + 1,
          endColumn: trimmed.length + 1,
        })
        continue
      }

      // For CREATE TABLE, check for opening parenthesis
      if (/^CREATE\s+(?:OR\s+REPLACE\s+)?TABLE\s+/i.test(trimmed)) {
        if (!/\(/.test(trimmed)) {
          let foundParen = false
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            if (/\(/.test(lines[j])) {
              foundParen = true
              break
            }
          }

          if (!foundParen) {
            errors.push({
              message: "Expected '(' after table name",
              startLineNumber: i + 1,
              startColumn: trimmed.length,
              endLineNumber: i + 1,
              endColumn: trimmed.length + 1,
            })
          }
        }
      }

      // Check for missing semicolon at end of CREATE statement
      const fullStatement = extractStatement(lines, i)
      if (fullStatement.text && !fullStatement.text.trim().endsWith(";")) {
        const endLine = fullStatement.endLine
        const endLineText = lines[endLine]
        errors.push({
          message: "Missing semicolon at end of statement",
          startLineNumber: endLine + 1,
          startColumn: endLineText.length,
          endLineNumber: endLine + 1,
          endColumn: endLineText.length + 1,
        })
      }
    }

    // Check for ALTER TABLE statements
    if (/^ALTER\s+TABLE\s+/i.test(trimmed)) {
      // Check for missing semicolon
      const fullStatement = extractStatement(lines, i)
      if (fullStatement.text && !fullStatement.text.trim().endsWith(";")) {
        const endLine = fullStatement.endLine
        const endLineText = lines[endLine]
        errors.push({
          message: "Missing semicolon at end of ALTER TABLE statement",
          startLineNumber: endLine + 1,
          startColumn: endLineText.length,
          endLineNumber: endLine + 1,
          endColumn: endLineText.length + 1,
        })
      }
    }

    // Check for orphaned SQL keywords that don't form valid statements
    const orphanedKeywords =
      /^(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|TABLE|VIEW)\s/i
    if (
      orphanedKeywords.test(trimmed) &&
      !trimmed.startsWith("CREATE") &&
      !trimmed.startsWith("ALTER") &&
      !isInsideCreateView(lines, i)
    ) {
      errors.push({
        message:
          "Unexpected SQL keyword. Statement must start with CREATE or ALTER",
        startLineNumber: i + 1,
        startColumn: 1,
        endLineNumber: i + 1,
        endColumn: trimmed.split(/\s+/)[0].length + 1,
      })
    }

    // Check for invalid characters or malformed syntax
    if (
      !/^(CREATE|ALTER|SELECT|INSERT|UPDATE|DELETE|WITH|--)/i.test(trimmed) &&
      trimmed.length > 0 &&
      !/^[);]/.test(trimmed)
    ) {
      // Check if it's not part of a multi-line statement
      const prevNonEmpty = findPreviousNonEmpty(lines, i)
      if (
        prevNonEmpty === -1 ||
        (lines[prevNonEmpty].trim().endsWith(";") &&
          !lines[prevNonEmpty].trim().match(/\($|,$|,\s*$/))
      ) {
        // Don't flag if we're inside a CREATE VIEW
        if (!isInsideCreateView(lines, i)) {
          errors.push({
            message: "Invalid syntax.",
            startLineNumber: i + 1,
            startColumn: 1,
            endLineNumber: i + 1,
            endColumn: Math.min(30, trimmed.length + 1),
          })
        }
      }
    }
  }
}

// Extract full statement from multiple lines
const extractStatement = (
  lines: string[],
  startIdx: number,
): { text: string; endLine: number } => {
  let statement = lines[startIdx]
  let endLine = startIdx

  // Find the end of statement (semicolon or end of related lines)
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith("--")) continue

    // Stop if we hit a new statement (before adding it)
    if (/^(CREATE|ALTER)\s+/i.test(line)) break

    statement += " " + line
    endLine = i

    if (line.includes(";")) break
  }

  return { text: statement, endLine }
}

// Find previous non-empty, non-comment line
const findPreviousNonEmpty = (lines: string[], currentIdx: number): number => {
  for (let i = currentIdx - 1; i >= 0; i--) {
    const trimmed = lines[i].trim()
    if (trimmed && !trimmed.startsWith("--")) {
      return i
    }
  }
  return -1
}

export const parseSchema = (text: string): SchemaData => {
  const tables: SchemaTable[] = []
  const refs: SchemaRef[] = []
  const fetchedCols = new Set<string>()
  const errors: SchemaError[] = []

  if (!text) return { tables, refs, fetchedCols, errors }

  validateSyntax(text, errors)

  const maskedText = text
    .replace(/--.*$/gm, (m) => " ".repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))

  // Tables
  const tableRegex =
    /CREATE\s+(?:OR\s+REPLACE\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:\[[^\]]+\]|\w+)\.)?(?:\[([^\]]+)\]|(\w+))\s*\(([^;]+)\);?/gi
  let match
  while ((match = tableRegex.exec(maskedText)) !== null) {
    const pos = getLinePos(text, match.index)
    const tableName = match[1] || match[2] // match[1] is bracketed content, match[2] is unbracketed
    tables.push({
      name: tableName,
      columns: parseColumns(match[3]),
      type: "table",
      line: pos.line,
      column: pos.col,
    })
  }

  // Views
  const viewRegex =
    /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?:(?:\[[^\]]+\]|\w+)\.)?(?:\[([^\]]+)\]|(\w+))\s*(?:\(([^)]+)\))?\s*AS\s+([\s\S]+?)(?:;|$)/gi
  while ((match = viewRegex.exec(maskedText)) !== null) {
    const pos = getLinePos(text, match.index)
    const viewName = match[1] || match[2]
    tables.push({
      name: viewName,
      columns: parseSelectColumns(match[4]),
      type: "view",
      line: pos.line,
      column: pos.col,
    })
  }

  // System Refs
  const sqlRefRegex =
    /ALTER\s+TABLE\s+(?:(?:\[[^\]]+\]|\w+)\.)?(?:\[([^\]]+)\]|(\w+))\s+ADD\s+(?:CONSTRAINT\s+\w+\s+)?FOREIGN\s+KEY\s*\((?:\[)?(["`]?[\w\s]+["`]?)(?:\])?\)\s*REFERENCES\s+(?:(?:\[[^\]]+\]|\w+)\.)?(?:\[([^\]]+)\]|(\w+))\s*\((?:\[)?(["`]?[\w\s]+["`]?)(?:\])?\)/gi
  while ((match = sqlRefRegex.exec(maskedText)) !== null) {
    const pos = getLinePos(text, match.index)
    const fromTable = match[1] || match[2]
    const toTable = match[4] || match[5]
    // Clean brackets from column names if regex captured them
    refs.push({
      id: `sys-${match.index}`,
      fromTable: fromTable,
      fromCol: match[3].replace(/["`[\]]/g, ""),
      toTable: toTable,
      toCol: match[6].replace(/["`[\]]/g, ""),
      isSystem: true,
      line: pos.line,
      column: pos.col,
    })
  }

  // User Refs (Comments)
  const userRefRegex =
    /--\s*Ref:\s*((?:\[[^\]]+\]|\w+))["`]?\.["`]?((?:\[[^\]]+\]|\w+))["`]?\s*[>=<-]\s*((?:\[[^\]]+\]|\w+))["`]?\.["`]?((?:\[[^\]]+\]|\w+))["`]?/gi
  while ((match = userRefRegex.exec(text)) !== null) {
    const pos = getLinePos(text, match.index)
    // Remove brackets from captured groups
    const fromTable = match[1].replace(/[[\]]/g, "")
    const fromCol = match[2].replace(/[[\]]/g, "")
    const toTable = match[3].replace(/[[\]]/g, "")
    const toCol = match[4].replace(/[[\]]/g, "")

    refs.push({
      id: `usr-${match.index}`,
      fromTable,
      fromCol,
      toTable,
      toCol,
      isSystem: false,
      line: pos.line,
      column: pos.col,
    })

    const fromT = tables.find((t) => t.name === fromTable)
    const toT = tables.find((t) => t.name === toTable)
    let errorMsg = null

    if (!fromT) {
      errorMsg = `Source table '${fromTable}' not found`
    } else if (fromT.type === "table") {
      const colDef = fromT.columns.find((c) => c.name === fromCol)
      if (!colDef) {
        errorMsg = `Column '${fromCol}' not found in '${fromTable}'`
      }
      // If table exists, column exists, check target table exists to compare types
      else if (toT && toT.type === "table") {
        const targetColDef = toT.columns.find((c) => c.name === toCol)
        if (targetColDef) {
          // Both columns exist, check types
          if (!checkTypeCompatibility(colDef.type, targetColDef.type)) {
            errorMsg = `Type Mismatch: '${fromTable}.${fromCol}' (${colDef.type}) cannot reference '${toTable}.${toCol}' (${targetColDef.type})`
          }
        }
      }
    }

    if (!errorMsg) {
      if (!toT) {
        errorMsg = `Target table '${toTable}' not found`
      } else if (
        toT.type === "table" &&
        !toT.columns.find((c) => c.name === toCol)
      ) {
        errorMsg = `Column '${toCol}' not found in '${toTable}'`
      }
    }

    if (errorMsg) {
      const end = getLinePos(text, match.index + match[0].length)
      errors.push({
        message: errorMsg,
        startLineNumber: pos.line,
        startColumn: pos.col,
        endLineNumber: end.line,
        endColumn: end.col,
      })
    }
  }

  // Fetch
  const fetchRegex = /--\s*fetch:\s*\[([^\]]+)\]/gi
  while ((match = fetchRegex.exec(text)) !== null) {
    match[1]
      .split(",")
      .forEach((i) => fetchedCols.add(i.trim().replace(/[[\]]/g, "")))
  }

  refs.forEach((ref) => {
    const fromT = tables.find((t) => t.name === ref.fromTable)
    if (fromT && fromT.type === "table") {
      const col = fromT.columns.find((c) => c.name === ref.fromCol)
      if (col) col.isFk = true
    }
  })

  return { tables, refs, fetchedCols, errors }
}
