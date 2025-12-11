import { Edge, Position } from "@xyflow/react";
import dagre from "dagre";
import { AppNode, SchemaTable } from "./types";

const NODE_WIDTH = 280;
const HEADER_HEIGHT = 50;
const ROW_HEIGHT = 40;

export const getLayoutedElements = (
  nodes: AppNode[], 
  edges: Edge[],
  tables: SchemaTable[]
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ rankdir: "LR" });

  nodes.forEach((node) => {
    const tableData = tables.find((t) => t.name === node.id);
    const colCount = tableData ? tableData.columns.length : 1;
    const height = HEADER_HEIGHT + colCount * ROW_HEIGHT + 20;

    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - dagreGraph.node(node.id).height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};
