import { type Edge, Position } from "@xyflow/react"
import dagre from "dagre"

import type { AppNode, SchemaTable } from "./types"

const NODE_WIDTH = 350
const HEADER_HEIGHT = 50
const ROW_HEIGHT = 40
const SPACING_X = 150 // Increased horizontal spacing between connected nodes
const SPACING_Y = 100 // Increased vertical spacing
const ISOLATED_SPACING_X = 80 // Spacing for isolated tables
const ISOLATED_SPACING_Y = 80
const ISOLATED_GRID_COLS = 4 // Reduced to 4 columns for better visibility

/**
 * Calculate node height based on number of columns
 */
const calculateNodeHeight = (columnCount: number): number => {
  return HEADER_HEIGHT + columnCount * ROW_HEIGHT + 20
}

/**
 * Layouts nodes using dagre for connected nodes and grid for isolated nodes
 */
export const getLayoutedElements = (
  nodes: AppNode[],
  edges: Edge[],
  tables: SchemaTable[],
) => {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))

  // Use Left-to-Right layout for better readability
  dagreGraph.setGraph({
    rankdir: "LR",
    nodesep: SPACING_X,
    ranksep: SPACING_Y,
    marginx: 50,
    marginy: 50,
  })

  // Separate Connected vs Isolated Nodes
  const connectedNodeIds = new Set<string>()
  edges.forEach((edge) => {
    connectedNodeIds.add(edge.source)
    connectedNodeIds.add(edge.target)
  })

  const connectedNodes: AppNode[] = []
  const isolatedNodes: AppNode[] = []

  nodes.forEach((node) => {
    if (connectedNodeIds.has(node.id)) {
      connectedNodes.push(node)
    } else {
      isolatedNodes.push(node)
    }
  })

  // Layout connected nodes with dagre
  connectedNodes.forEach((node) => {
    const tableData = tables.find((t) => t.name === node.id)
    const colCount = tableData ? tableData.columns.length : 1
    const height = calculateNodeHeight(colCount)
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height })
  })

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  let maxConnectedX = 0
  let maxConnectedY = 0

  // Apply dagre layout to connected nodes
  const layoutedConnectedNodes = connectedNodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)

    // Center the node at the dagre position
    const x = nodeWithPosition.x - NODE_WIDTH / 2
    const y = nodeWithPosition.y - nodeWithPosition.height / 2

    maxConnectedX = Math.max(maxConnectedX, x + NODE_WIDTH)
    maxConnectedY = Math.max(maxConnectedY, y + nodeWithPosition.height)

    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: { x, y },
    }
  })

  // Layout isolated nodes in a grid to the right of connected nodes
  const startX = connectedNodes.length > 0 ? maxConnectedX + SPACING_X * 2 : 0
  const startY = 0

  // Track height of each column for balanced grid
  const columnHeights = new Array(ISOLATED_GRID_COLS).fill(startY)

  const layoutedIsolatedNodes = isolatedNodes.map((node) => {
    const tableData = tables.find((t) => t.name === node.id)
    const colCount = tableData ? tableData.columns.length : 1
    const height = calculateNodeHeight(colCount)

    // Find column with minimum height for balanced layout
    const colIndex = columnHeights.indexOf(Math.min(...columnHeights))

    const x = startX + colIndex * (NODE_WIDTH + ISOLATED_SPACING_X)
    const y = columnHeights[colIndex]

    // Update column height
    columnHeights[colIndex] += height + ISOLATED_SPACING_Y

    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: { x, y },
    }
  })

  return {
    nodes: [...layoutedConnectedNodes, ...layoutedIsolatedNodes],
    edges,
  }
}
