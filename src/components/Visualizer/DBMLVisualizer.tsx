import {
  type Connection,
  Controls,
  MarkerType,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react"
import { useCallback, useEffect, useMemo } from "react"
import { getLayoutedElements } from "../../lib/layout"
import type { CustomNodeType, SchemaData } from "../../lib/types"
import { RefEdge } from "./RefEdge"
import { RefLine } from "./RefLine"
import { TableNode } from "./TableNode"
import "@xyflow/react/dist/style.css"

interface Props {
  data: SchemaData
  onEdgeDelete?: (refId: string) => void
  onEdgeCreate?: (connection: Connection) => void
  selectedColumns?: Set<string>
  onColumnToggle?: (tableName: string, columnName: string) => void
  readonly?: boolean
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
  readonly = false,
}: Props) {
  const initialData = useMemo(() => {
    const baseNodes: CustomNodeType[] = data.tables.map((table) => ({
      id: table.name,
      type: "tableNode" as const,
      data: {
        table,
        selectedColumns,
        onColumnToggle: readonly ? undefined : onColumnToggle,
        fetchedCols: new Set<string>(),
      },
      position: { x: 0, y: 0 },
    }))

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
        onDelete: readonly ? undefined : onEdgeDelete,
      },
    }))

    return getLayoutedElements(baseNodes, baseEdges, data.tables)
  }, [data, onEdgeDelete, selectedColumns, onColumnToggle, readonly])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialData.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialData.edges)

  useEffect(() => {
    setNodes(initialData.nodes)
    setEdges(initialData.edges)
  }, [initialData.nodes, initialData.edges, setNodes, setEdges])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readonly) return

      if (
        !connection.source ||
        !connection.target ||
        !connection.sourceHandle ||
        !connection.targetHandle
      ) {
        return
      }

      if (onEdgeCreate) {
        onEdgeCreate(connection)
      }
    },
    [onEdgeCreate, readonly],
  )

  return (
    <div className="flex-1 h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={readonly ? undefined : onConnect}
        connectionLineComponent={readonly ? undefined : (RefLine as any)}
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
        // Disable all interaction that mutates the graph when readonly
        nodesDraggable={!readonly}
        nodesConnectable={!readonly}
        elementsSelectable={!readonly}
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
