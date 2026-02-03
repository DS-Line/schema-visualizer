import type { Node } from "@xyflow/react"

export interface SchemaCol {
  name: string
  type: string
  isPk: boolean
  isFk: boolean
}

export interface SchemaTable {
  name: string
  columns: SchemaCol[]
  type: "table" | "view"
  line: number
  column: number
}

export interface SchemaRef {
  id: string
  fromTable: string
  fromCol: string
  toTable: string
  toCol: string
  isSystem: boolean
  line: number
  column: number
}

export interface SchemaError {
  message: string
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
}

export interface SchemaData {
  tables: SchemaTable[]
  refs: SchemaRef[]
  fetchedCols: Set<string>
  errors: SchemaError[]
}

export type CustomNodeData = {
  table: SchemaTable
  fetchedCols: Set<string>
}

export type CustomNodeType = Node<CustomNodeData, "customTable">

export type AppNode = CustomNodeType
