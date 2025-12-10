// src/lib/types.ts
import type { Node, Edge } from '@xyflow/react';

export interface SchemaCol {
  name: string;
  type: string;
  isPk: boolean;
  isFk: boolean;
}

export interface SchemaTable {
  name: string;
  columns: SchemaCol[];
  type: 'table' | 'view';
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

// --- React Flow Specific Types ---

// 1. Define the Data shape for your Custom Node
export type CustomNodeData = {
  table: SchemaTable;
  fetchedCols: Set<string>;
};

// 2. Define the specific Node Type
// Node<Data, TypeName>
export type CustomNodeType = Node<CustomNodeData, 'customTable'>;

// 3. Union type if you had multiple node types (we only have one for now)
export type AppNode = CustomNodeType;