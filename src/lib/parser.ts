import { Parser } from "@dbml/core"
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

export const parseSchema = (dbmlString: string): SchemaData => {
  let tables: SchemaTable[] = []
  let refs: SchemaRef[] = []
  const fetchedCols = new Set<string>()
  const errors: SchemaError[] = []

  try {
    const database = Parser.parse(dbmlString, "dbml")

    tables = database.schemas.flatMap((schema) =>
      schema.tables.map((table) => ({
        name: table.name,
        columns: table.fields.map((field) => {
          // Handle type arguments (e.g., varchar(255))
          let type = field.type.type_name
          if (
            field.type.args &&
            Array.isArray(field.type.args) &&
            field.type.args.length > 0
          ) {
            const args = field.type.args.map((arg: any) => arg.value).join(",")
            type += `(${args})`
          }

          return {
            name: field.name,
            type: type,
            isPk: field.pk || false,
            unique: field.unique || false,
            not_null: field.not_null || false,
          }
        }),
      })),
    )

    refs = database.schemas.flatMap((schema) =>
      schema.refs.map((ref, index) => {
        const endpoint1 = ref.endpoints[0]
        const endpoint2 = ref.endpoints[1]

        return {
          id: `rel-${index}`,
          fromTable: endpoint1.tableName,
          fromCol: endpoint1.fieldNames[0],
          toTable: endpoint2.tableName,
          toCol: endpoint2.fieldNames[0],
          relationType: ">" as const, // many-to-one by default
        }
      }),
    )

    console.log(tables)
    return { tables, refs, fetchedCols, errors }
  } catch (e) {
    console.error(e)
    return { tables, refs, fetchedCols, errors }
  }
}
