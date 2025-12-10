// src/lib/types.ts
import type { Node, Edge } from "@xyflow/react";

export interface SchemaCol {
  name: string;
  type: string;
  isPk: boolean;
  isFk: boolean;
}

export interface SchemaTable {
  name: string;
  columns: SchemaCol[];
  type: "table" | "view";
}

export interface SchemaRef {
  id: string;
  fromTable: string;
  fromCol: string;
  toTable: string;
  toCol: string;
  isSystem: boolean;
}

export interface SchemaData {
  tables: SchemaTable[];
  refs: SchemaRef[];
  fetchedCols: Set<string>;
  error: string | null;
}

export type CustomNodeData = {
  table: SchemaTable;
  fetchedCols: Set<string>;
};

export type CustomNodeType = Node<CustomNodeData, "customTable">;

export type AppNode = CustomNodeType;
