import {
  Compiler,
  type Database,
  type Ref as DbmlRef,
  type Table as DbmlTable,
} from "@dbml/parse"
import type { SchemaData, SchemaRef, SchemaTable } from "./types"

export const parseSchema = (dbmlString: string): SchemaData => {
  const errors: SchemaData["errors"] = []

  try {
    const compiler = new Compiler()
    compiler.setSource(dbmlString)
    const database = compiler.parse.rawDb() as Database | undefined

    if (!database) {
      return { tables: [], refs: [], errors }
    }

    const tables: SchemaTable[] = (database.tables as DbmlTable[]).map(
      (table) => ({
        name: table.name,
        columns: table.fields.map((field) => {
          let type = field.type.type_name
          if (Array.isArray(field.type.args) && field.type.args.length > 0) {
            const args = (field.type.args as Array<{ value: unknown }>)
              .map((arg) => arg.value)
              .join(",")
            type += `(${args})`
          }
          return {
            name: field.name,
            type,
            isPk: field.pk || false,
            unique: field.unique || false,
            not_null: field.not_null || false,
          }
        }),
      }),
    )

    const refs: SchemaRef[] = (database.refs as DbmlRef[]).map((ref, index) => {
      const [ep1, ep2] = ref.endpoints
      return {
        id: `ref-${index}`,
        fromTable: ep1.tableName,
        fromCol: ep1.fieldNames[0],
        toTable: ep2.tableName,
        toCol: ep2.fieldNames[0],
        relationType: ">" as const,
      }
    })

    return { tables, refs, errors }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to parse DBML"
    return {
      tables: [],
      refs: [],
      errors: [{ message, startLineNumber: 0, startColumn: 0, endLineNumber: 0, endColumn: 0 }],
    }
  }
}
