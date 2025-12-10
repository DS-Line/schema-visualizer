import { SchemaData, SchemaTable, SchemaRef, SchemaCol } from "./types";

// Helper: Parse standard CREATE TABLE columns
const parseSQLColumns = (body: string): SchemaCol[] => {
  return body
    .split(/,(?![^(]*\))/)
    .map((colStr): SchemaCol | null => {
      const parts = colStr.trim().split(/\s+/);
      const first = parts[0]?.toUpperCase();
      if (
        !first ||
        /^(PRIMARY|CONSTRAINT|FOREIGN|KEY|UNIQUE|CHECK|INDEX)/.test(first)
      )
        return null;

      const name = parts[0].replace(/["`]/g, "");
      const type = parts.slice(1).join(" ").split(/(\s+)/)[0].replace(",", "");
      const isPk = /PRIMARY KEY/i.test(colStr);

      return { name, type, isPk, isFk: false };
    })
    .filter((c): c is SchemaCol => c !== null);
};

// Helper: Parse SELECT columns for Views (V1 Logic Restored)
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
          type: "",
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
        type: "",
        isPk: false,
        isFk: false,
      };
    })
    .filter((c) => c.name && c.name !== "*" && !c.name.includes(" "));
};

export const parseSchema = (text: string): SchemaData => {
  const tables: SchemaTable[] = [];
  const refs: SchemaRef[] = [];
  const fetchedCols = new Set<string>();
  let error: string | null = null;

  if (!text) return { tables, refs, fetchedCols, error };

  const maskedText = text
    .replace(/--.*$/gm, (m) => " ".repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length));

  // 1. Tables
  const tableRegex =
    /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["`]?(\w+)["`]?\s*\(([^;]+)\);?/gi;
  let match;
  while ((match = tableRegex.exec(maskedText)) !== null) {
    tables.push({
      name: match[1],
      columns: parseSQLColumns(match[2]),
      type: "table",
    });
  }

  // 2. Views (Fixed)
  const viewRegex =
    /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+["`]?(\w+)["`]?\s*(?:\(([^)]+)\))?\s*AS\s+([\s\S]+?)(?:;|$)/gi;
  while ((match = viewRegex.exec(maskedText)) !== null) {
    const body = match[3];
    const columns = parseSelectColumns(body);
    tables.push({ name: match[1], columns: columns, type: "view" });
  }

  // 3. System Refs
  const sqlRefRegex =
    /ALTER TABLE\s+["`]?(\w+)["`]?\s+ADD\s+(?:CONSTRAINT\s+\w+\s+)?FOREIGN KEY\s*\((["`]?\w+["`]?)\)\s*REFERENCES\s+["`]?(\w+)["`]?\s*\((["`]?\w+["`]?)\)/gi;
  while ((match = sqlRefRegex.exec(maskedText)) !== null) {
    refs.push({
      id: `sys-${match.index}`,
      fromTable: match[1],
      fromCol: match[2].replace(/["`]/g, ""),
      toTable: match[3],
      toCol: match[4].replace(/["`]/g, ""),
      isSystem: true,
    });
  }

  // 4. User Refs
  const userRefRegex =
    /--\s*Ref:\s*(\w+)["`]?\.["`]?(\w+)["`]?\s*[>=<\-]\s*(\w+)["`]?\.["`]?(\w+)["`]?/gi;
  while ((match = userRefRegex.exec(text)) !== null) {
    refs.push({
      id: `usr-${match.index}`,
      fromTable: match[1],
      fromCol: match[2],
      toTable: match[3],
      toCol: match[4],
      isSystem: false,
    });
  }

  // 5. Fetch
  const fetchRegex = /--\s*fetch:\s*\[([^\]]+)\]/gi;
  while ((match = fetchRegex.exec(text)) !== null) {
    match[1].split(",").forEach((i) => fetchedCols.add(i.trim()));
  }

  // 6. Validation
  refs.forEach((ref) => {
    const fromT = tables.find((t) => t.name === ref.fromTable);
    const toT = tables.find((t) => t.name === ref.toTable);

    // Only flag errors for Tables, Views are more flexible
    if (!fromT) {
      error = `Error: Table '${ref.fromTable}' not found.`;
    } else if (
      fromT.type === "table" &&
      !fromT.columns.find((c) => c.name === ref.fromCol)
    ) {
      error = `Error: Column '${ref.fromCol}' not found in '${ref.fromTable}'.`;
    }

    if (fromT && fromT.type === "table") {
      const col = fromT.columns.find((c) => c.name === ref.fromCol);
      if (col) col.isFk = true;
    }
  });

  return { tables, refs, fetchedCols, error };
};
