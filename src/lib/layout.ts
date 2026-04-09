import { type Edge, Position } from "@xyflow/react"
import dagre from "dagre"
import type { AppNode, SchemaTable } from "./types"

// These must stay in sync with TableNode's rendering constants
export const NODE_WIDTH = 288 // w-72 = 18rem = 288px
const HEADER_HEIGHT = 44 // pt-3 pb-2 + leading-4 text
const ROW_HEIGHT = 26 // matches TableNode ROW_HEIGHT
const COLLAPSE_THRESHOLD = 8 // matches TableNode COLLAPSE_THRESHOLD
const COLLAPSE_BUTTON_HEIGHT = 32

const CONNECTED_SPACING_X = 80 // vertical gap between nodes in the same rank
const CONNECTED_SPACING_Y = 320 // horizontal gap between ranks
const ISOLATED_SPACING_X = 80
const ISOLATED_SPACING_Y = 80
const ISOLATED_GRID_COLS = 4

/**
 * Estimates the rendered height of a table node.
 * Accounts for the collapse button shown when columns exceed COLLAPSE_THRESHOLD.
 */
const estimateNodeHeight = (columnCount: number, isCollapsed: boolean): number => {
  const visibleRows = isCollapsed
    ? Math.min(columnCount, COLLAPSE_THRESHOLD)
    : columnCount
  const hasCollapseButton = columnCount > COLLAPSE_THRESHOLD
  return (
    HEADER_HEIGHT +
    visibleRows * ROW_HEIGHT +
    (hasCollapseButton ? COLLAPSE_BUTTON_HEIGHT : 0)
  )
}

/**
 * Lays out nodes using dagre for connected nodes and a balanced grid for isolated nodes.
 */
export const getLayoutedElements = (
  nodes: AppNode[],
  edges: Edge[],
  tables: SchemaTable[],
  collapsedTables: Set<string> = new Set(),
) => {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({
    rankdir: "LR",
    nodesep: CONNECTED_SPACING_X,
    ranksep: CONNECTED_SPACING_Y,
    marginx: 50,
    marginy: 50,
  })

  const connectedNodeIds = new Set<string>()
  for (const edge of edges) {
    connectedNodeIds.add(edge.source)
    connectedNodeIds.add(edge.target)
  }

  const connectedNodes: AppNode[] = []
  const isolatedNodes: AppNode[] = []
  for (const node of nodes) {
    if (connectedNodeIds.has(node.id)) connectedNodes.push(node)
    else isolatedNodes.push(node)
  }

  // Layout connected nodes with dagre
  for (const node of connectedNodes) {
    const table = tables.find((t) => t.name === node.id)
    const isCollapsed = collapsedTables.has(node.id)
    const height = estimateNodeHeight(table?.columns.length ?? 1, isCollapsed)
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height })
  }
  for (const edge of edges) {
    dagreGraph.setEdge(edge.source, edge.target)
  }
  dagre.layout(dagreGraph)

  let maxConnectedX = 0
  const layoutedConnectedNodes = connectedNodes.map((node) => {
    const { x, y, height } = dagreGraph.node(node.id)
    const posX = x - NODE_WIDTH / 2
    const posY = y - height / 2
    maxConnectedX = Math.max(maxConnectedX, posX + NODE_WIDTH)
    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: { x: posX, y: posY },
    }
  })

  // Layout isolated nodes in a balanced grid to the right of connected nodes
  const startX =
    connectedNodes.length > 0 ? maxConnectedX + CONNECTED_SPACING_Y * 2 : 0
  const columnHeights = new Array<number>(ISOLATED_GRID_COLS).fill(0)

  const layoutedIsolatedNodes = isolatedNodes.map((node) => {
    const table = tables.find((t) => t.name === node.id)
    const isCollapsed = collapsedTables.has(node.id)
    const height = estimateNodeHeight(table?.columns.length ?? 1, isCollapsed)
    const colIndex = columnHeights.indexOf(Math.min(...columnHeights))
    const x = startX + colIndex * (NODE_WIDTH + ISOLATED_SPACING_X)
    const y = columnHeights[colIndex]
    columnHeights[colIndex] += height + ISOLATED_SPACING_Y
    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: { x, y },
    }
  })

  return { nodes: [...layoutedConnectedNodes, ...layoutedIsolatedNodes], edges }
}
