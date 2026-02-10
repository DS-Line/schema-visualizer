import {
  type Connection,
  Controls,
  MarkerType,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react"
import { useCallback, useEffect, useMemo } from "react"
import { RefEdge } from "@/components/Visualizer/RefEdge"
import { RefLine } from "@/components/Visualizer/RefLine"
import { TableNode } from "@/components/Visualizer/TableNode"
import { getLayoutedElements } from "@/lib/layout"
import type { SchemaData } from "@/lib/types"
import "@xyflow/react/dist/style.css"

interface Props {
  data: SchemaData
  onEdgeDelete?: (refId: string) => void
  onEdgeCreate?: (connection: Connection) => void
  selectedColumns?: Set<string>
  onColumnToggle?: (tableName: string, columnName: string) => void
}

const nodeTypes = {
  tableNode: TableNode,
}

const edgeTypes = {
  refEdge: RefEdge,
}

export default function DBMLVisualizer({
  data,
  onEdgeDelete,
  onEdgeCreate,
  selectedColumns,
  onColumnToggle,
}: Props) {
  const initialData = useMemo(() => {
    // Create base nodes with data
    const baseNodes = data.tables.map((table) => ({
      id: table.name,
      type: "tableNode" as const,
      data: {
        table,
        selectedColumns,
        onColumnToggle,
      },
      position: { x: 0, y: 0 }, // Will be set by layout algorithm
    }))

    // Create edges from relationships
    const baseEdges = (data.refs || []).map((ref) => ({
      id: ref.id,
      source: ref.fromTable,
      sourceHandle: ref.fromCol,
      target: ref.toTable,
      targetHandle: ref.toCol,
      type: "refEdge" as const,
      animated: false,
      style: { stroke: "#35383D", strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "#35383D",
      },
      data: {
        refId: ref.id,
        onDelete: onEdgeDelete,
      },
    }))

    // Apply sophisticated dagre layout algorithm
    const layouted = getLayoutedElements(baseNodes, baseEdges, data.tables)

    return layouted
  }, [data, onEdgeDelete, selectedColumns, onColumnToggle])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialData.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialData.edges)

  // Update nodes and edges when data changes
  useEffect(() => {
    setNodes(initialData.nodes)
    setEdges(initialData.edges)
  }, [initialData.nodes, initialData.edges, setNodes, setEdges])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (
        !connection.source ||
        !connection.target ||
        !connection.sourceHandle ||
        !connection.targetHandle
      ) {
        return
      }

      // Notify parent component about new connection
      if (onEdgeCreate) {
        onEdgeCreate(connection)
      }
    },
    [onEdgeCreate],
  )

  return (
    <div className="flex-1 h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        connectionLineComponent={RefLine}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{
          padding: 0.2,
          minZoom: 0.5,
          maxZoom: 1.5,
        }}
        proOptions={{ hideAttribution: true }}
        className="bg-white"
        minZoom={0.1}
        maxZoom={2}
      >
        <Controls
          showInteractive={false}
          position="top-right"
          orientation="horizontal"
          className="rounded"
        />
      </ReactFlow>
    </div>
  )
}
