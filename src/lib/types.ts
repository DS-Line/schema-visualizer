export interface SchemaCol {
  name: string;
  type: string;
  isPk: boolean;
  isFk: boolean;
}

export interface SchemaNode {
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
  nodes: SchemaNode[];
  refs: SchemaRef[];
  fetchedCols: Set<string>;
  error: string | null;
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface DraggingState {
  name: string;
  origX: number;
  origY: number;
  mouseX: number;
  mouseY: number;
}

export interface ConnectingState {
  startTable: string;
  startCol: string;
  startX: number;
  startY: number;
  currX: number;
  currY: number;
}
