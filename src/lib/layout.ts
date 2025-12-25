import { Edge, Position } from "@xyflow/react";
import dagre from "dagre";

import { AppNode, SchemaTable } from "./types";

const NODE_WIDTH = 350;
const HEADER_HEIGHT = 50;
const ROW_HEIGHT = 40;
const SPACING_X = 30;
const SPACING_Y = 50;
const ISOLATED_GRID_COLS = 6; // How many columns for unconnected tables

export const getLayoutedElements = (
  nodes: AppNode[],
  edges: Edge[],
  tables: SchemaTable[]
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // 'LR' (Left-to-Right) or 'TB' (Top-to-Bottom)
  dagreGraph.setGraph({ rankdir: "LR" });

  // Separate Connected vs Isolated Nodes
  const connectedNodeIds = new Set<string>();
  edges.forEach((edge) => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });

  const connectedNodes: AppNode[] = [];
  const isolatedNodes: AppNode[] = [];

  nodes.forEach((node) => {
    if (connectedNodeIds.has(node.id)) {
      connectedNodes.push(node);
    } else {
      isolatedNodes.push(node);
    }
  });

  connectedNodes.forEach((node) => {
    const tableData = tables.find((t) => t.name === node.id);
    const colCount = tableData ? tableData.columns.length : 1;
    const height = HEADER_HEIGHT + colCount * ROW_HEIGHT + 20;
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  let maxConnectedX = 0;

  const layoutedConnectedNodes = connectedNodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    const x = nodeWithPosition.x - NODE_WIDTH / 2;
    const y = nodeWithPosition.y - dagreGraph.node(node.id).height / 2;

    maxConnectedX = Math.max(maxConnectedX, x + NODE_WIDTH);

    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: { x, y },
    };
  });

  const startX = connectedNodes.length > 0 ? maxConnectedX + SPACING_X * 2 : 0;

  const columnHeights = new Array(ISOLATED_GRID_COLS).fill(0);

  const layoutedIsolatedNodes = isolatedNodes.map((node, index) => {
    const tableData = tables.find((t) => t.name === node.id);
    const colCount = tableData ? tableData.columns.length : 1;
    const height = HEADER_HEIGHT + colCount * ROW_HEIGHT + 20;

    const colIndex = index % ISOLATED_GRID_COLS;

    const x = startX + colIndex * (NODE_WIDTH + SPACING_X);

    const y = columnHeights[colIndex];

    columnHeights[colIndex] += height + SPACING_Y;

    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: { x, y },
    };
  });

  return {
    nodes: [...layoutedConnectedNodes, ...layoutedIsolatedNodes],
    edges,
  };
};
