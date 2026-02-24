import {
  Compiler,
  type Database,
  type Ref as DbmlRef,
  type Table as DbmlTable,
} from "@dbml/parse"
import type { SchemaData, SchemaError, SchemaRef, SchemaTable } from "./types"

export const parseSchema = (dbmlString: string): SchemaData => {
  let tables: SchemaTable[] = []
  let refs: SchemaRef[] = []
  const fetchedCols = new Set<string>()
  const errors: SchemaError[] = []

  try {
    const compiler = new Compiler()
    compiler.setSource(dbmlString)
    const database = compiler.parse.rawDb() as Database | undefined

    if (!database) {
      return { tables, refs, fetchedCols, errors }
    }

    // database.tables is already a flat list of tables
    tables = (database.tables as DbmlTable[]).map((table) => ({
      name: table.name,
      columns: table.fields.map((field) => {
        // Handle type arguments (e.g., varchar(255))
        let type = field.type.type_name
        if (
          field.type.args &&
          Array.isArray(field.type.args) &&
          (field.type.args as unknown[]).length > 0
        ) {
          const args = (field.type.args as any[])
            .map((arg) => arg.value)
            .join(",")
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
    }))

    refs = (database.refs as DbmlRef[]).map((ref, index) => {
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
    })

    return { tables, refs, fetchedCols, errors }
  } catch (e) {
    return { tables, refs, fetchedCols, errors }
  }
}
