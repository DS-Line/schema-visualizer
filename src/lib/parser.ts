import { SchemaData, SchemaNode, SchemaRef, SchemaCol } from "./types";

// Helper: Parse Columns from CREATE TABLE body
const parseSQLColumns = (
  body: string,
  tableName: string,
  refs: SchemaRef[]
): SchemaCol[] => {
  return body
    .split(/,(?![^(]*\))/)
    .map((colStr) => {
      colStr = colStr.trim();
      if (
        !colStr ||
        /^(PRIMARY|CONSTRAINT|FOREIGN|UNIQUE|INDEX|CHECK)/i.test(colStr)
      )
        return null;

      // Detect Inline References: user_id int REFERENCES users(id)
      const inlineRef = /(\w+)\s+.*\s+REFERENCES\s+(\w+)\s*\((\w+)\)/i.exec(
        colStr
      );
      if (inlineRef) {
        refs.push({
          id: `ref-inline-${tableName}-${inlineRef[1]}`,
          fromTable: tableName,
          fromCol: inlineRef[1],
          toTable: inlineRef[2],
          toCol: inlineRef[3],
          isSystem: true,
        });
      }

      const parts = colStr.split(/\s+/);
      const name = parts[0].replace(/["`]/g, "");
      let type = parts
        .slice(1)
        .filter(
          (p) =>
            ![
              "PRIMARY",
              "KEY",
              "NOT",
              "NULL",
              "REFERENCES",
              "DEFAULT",
              "AUTO_INCREMENT",
            ].includes(p.toUpperCase())
        )
        .join(" ");
      type = type.split("REFERENCES")[0].trim();
      const isPk = /PRIMARY KEY/i.test(colStr);

      return { name, type, isPk, isFk: false };
    })
    .filter((c): c is SchemaCol => c !== null);
};

// Parse Columns from CREATE VIEW body (Simple Select parsing)
const parseSelectColumns = (query: string): SchemaCol[] => {
  const selectMatch = /SELECT\s+([\s\S]+?)\s+FROM/i.exec(query);
  if (!selectMatch) return [];

  return selectMatch[1]
    .split(",")
    .map((col) => {
      let clean = col.trim();
      const asMatch = /(.+)\s+AS\s+(.+)/i.exec(clean);
      if (asMatch)
        return {
          name: asMatch[2].trim().replace(/["`]/g, ""),
          type: "unknown",
          isPk: false,
          isFk: false,
        };

      const dotIndex = clean.lastIndexOf(".");
      if (dotIndex > -1) clean = clean.substring(dotIndex + 1);

      const spaceParts = clean.split(/\s+/);
      if (spaceParts.length > 1 && !clean.includes("("))
        clean = spaceParts[spaceParts.length - 1];

      return {
        name: clean.replace(/["`]/g, ""),
        type: "unknown",
        isPk: false,
        isFk: false,
      };
    })
    .filter((c) => c.name && c.name !== "*" && !c.name.includes(" "));
};

export const parseSchema = (text: string): SchemaData => {
  const nodes: SchemaNode[] = [];
  const refs: SchemaRef[] = [];
  const fetchedCols = new Set<string>();
  let error: string | null = null;

  if (!text) return { nodes, refs, fetchedCols, error };

  // Mask comments for Regex safety (but keep structure)
  const maskedText = text
    .replace(/--.*$/gm, (m) => " ".repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length));

  // 1. Tables
  const createTableRegex =
    /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["`]?(\w+)["`]?\s*\(([^;]+)\);?/gi;
  let match;
  while ((match = createTableRegex.exec(maskedText)) !== null) {
    const tableName = match[1];
    const columns = parseSQLColumns(match[2], tableName, refs);
    nodes.push({ name: tableName, columns, type: "table" });
  }

  // 2. Views
  const createViewRegex =
    /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+["`]?(\w+)["`]?\s*(?:\(([^)]+)\))?\s*AS\s+([\s\S]+?)(?:;|$)/gi;
  while ((match = createViewRegex.exec(maskedText)) !== null) {
    const viewName = match[1];
    const explicitCols = match[2];
    const body = match[3];

    let columns: SchemaCol[] = [];
    if (explicitCols) {
      columns = explicitCols.split(",").map((c) => ({
        name: c.trim(),
        type: "unknown",
        isPk: false,
        isFk: false,
      }));
    } else {
      columns = parseSelectColumns(body);
    }
    nodes.push({ name: viewName, columns, type: "view" });
  }

  // 3. ALTER TABLE Foreign Keys
  const alterRefRegex =
    /ALTER TABLE\s+["`]?(\w+)["`]?\s+ADD\s+(?:CONSTRAINT\s+\w+\s+)?FOREIGN KEY\s*\((["`]?\w+["`]?)\)\s*REFERENCES\s+["`]?(\w+)["`]?\s*\((["`]?\w+["`]?)\)(?:;)?/gi;
  while ((match = alterRefRegex.exec(maskedText)) !== null) {
    refs.push({
      id: `ref-alter-${match.index}`,
      fromTable: match[1],
      fromCol: match[2].replace(/["`]/g, ""),
      toTable: match[3],
      toCol: match[4].replace(/["`]/g, ""),
      isSystem: true,
    });
  }

  // 4. Comment Directives (-- Ref: ...)
  // We use the original text here because maskedText replaced comments with spaces
  const dbmlRefRegex =
    /--\s*Ref:\s*(\w+)["`]?\.["`]?(\w+)["`]?\s*[>=<\-]\s*(\w+)["`]?\.["`]?(\w+)["`]?/gi;
  while ((match = dbmlRefRegex.exec(text)) !== null) {
    refs.push({
      id: `ref-dbml-${match.index}`,
      fromTable: match[1],
      fromCol: match[2],
      toTable: match[3],
      toCol: match[4],
      isSystem: false,
    });
  }

  // 5. Fetch Directives
  const fetchRegex = /--\s*fetch:\s*\[([^\]]+)\]/gi;
  while ((match = fetchRegex.exec(text)) !== null) {
    match[1].split(",").forEach((item) => {
      const parts = item.trim().split(".");
      if (parts.length === 2)
        fetchedCols.add(`${parts[0].trim()}.${parts[1].trim()}`);
    });
  }

  // 6. Post-Process (Mark FKs in columns)
  refs.forEach((ref) => {
    const fromNode = nodes.find((n) => n.name === ref.fromTable);
    const toNode = nodes.find((n) => n.name === ref.toTable);

    // Validation Logic
    if (!fromNode) {
      error = `Invalid reference: Table '${ref.fromTable}' does not exist.`;
    } else if (!fromNode.columns.find((c) => c.name === ref.fromCol)) {
      error = `Invalid reference: Column '${ref.fromCol}' does not exist in table '${ref.fromTable}'.`;
    } else if (!toNode) {
      error = `Invalid reference: Table '${ref.toTable}' does not exist.`;
    } else if (!toNode.columns.find((c) => c.name === ref.toCol)) {
      error = `Invalid reference: Column '${ref.toCol}' does not exist in table '${ref.toTable}'.`;
    }

    // Set FK flag if valid
    if (fromNode) {
      const col = fromNode.columns.find((c) => c.name === ref.fromCol);
      if (col) col.isFk = true;
    }
  });

  return { nodes, refs, fetchedCols, error };
};
