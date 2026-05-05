import {
  Background,
  type Connection,
  MarkerType,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react"
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { flushSync } from "react-dom"
import { getLayoutedElements } from "../../lib/layout"
import type { CustomNodeType, SchemaData } from "../../lib/types"
import { ConnectionLine } from "./ConnectionLine"
import { RelationshipEdge } from "./RelationshipEdge"
import { COLLAPSE_THRESHOLD, TableNode } from "./TableNode"
import { VisualizerControls } from "./VisualizerControls"
import "@xyflow/react/dist/style.css"

const LAYOUT_DURATION = 500
const ease = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2

interface Props {
  data: SchemaData
  onEdgeDelete?: (refId: string) => void
  onEdgeCreate?: (connection: Connection) => void
  onEdgeSelect?: (refId: string | null) => void
  cachedColumns?: Set<string>
  onColumnToggle?: (tableName: string, columnName: string) => void
  readonly?: boolean
  fullscreenRef?: RefObject<HTMLElement | null>
  sidebarCollapsed?: boolean
  autoArrange?: boolean
}

const nodeTypes = { tableNode: TableNode }
const edgeTypes = { refEdge: RelationshipEdge }

export default function SchemaVisualizer({
  data,
  onEdgeDelete,
  onEdgeCreate,
  onEdgeSelect: onEdgeSelectProp,
  cachedColumns,
  onColumnToggle,
  readonly = false,
  fullscreenRef,
  sidebarCollapsed,
  autoArrange = false,
}: Props) {
  // Collapse state lives here so it doesn't reset on cachedColumns changes.
  const [collapsedTables, setCollapsedTables] = useState<Set<string>>(
    () =>
      new Set(
        data.tables
          .filter((t) => t.columns.length > COLLAPSE_THRESHOLD)
          .map((t) => t.name),
      ),
  )

  const onToggleCollapse = useCallback((tableName: string) => {
    setCollapsedTables((prev) => {
      const next = new Set(prev)
      if (next.has(tableName)) next.delete(tableName)
      else next.add(tableName)
      return next
    })
  }, [])

  // Keep a synchronously-updated ref to data.refs so the layout memo can
  // read current refs without making them a reactive dependency.
  // This ensures that when tables and refs change together (e.g. DBML edit),
  // the layout uses the up-to-date refs.
  const refsRef = useRef(data.refs)
  refsRef.current = data.refs

  // Layout: recalculates when tables change or when a node is expanded/collapsed.
  // Ref changes (add/remove relationship) do NOT trigger re-layout,
  // so manually arranged node positions are preserved.
  const layoutData = useMemo(() => {
    const baseNodes: CustomNodeType[] = data.tables.map((table) => ({
      id: table.name,
      type: "tableNode" as const,
      data: {
        table,
        relatedCols: new Set<string>(),
      },
      position: { x: 0, y: 0 },
    }))

    const baseEdges = refsRef.current.map((ref) => ({
      id: ref.id,
      source: ref.fromTable,
      sourceHandle: ref.fromCol,
      target: ref.toTable,
      targetHandle: ref.toCol,
      type: "refEdge" as const,
      animated: false,
      style: { stroke: "#626468", strokeWidth: 2 },
      // markerEnd: { type: MarkerType.Arrow, color: "#626468", strokeWidth: 2 },
      data: { refId: ref.id },
    }))

    return getLayoutedElements(
      baseNodes,
      baseEdges,
      data.tables,
      collapsedTables,
    )
  }, [data.tables, collapsedTables])

  // Edges: recalculates when refs change. Does not affect node positions.
  const computedEdges = useMemo(
    () =>
      data.refs.map((ref) => ({
        id: ref.id,
        source: ref.fromTable,
        sourceHandle: ref.fromCol,
        target: ref.toTable,
        targetHandle: ref.toCol,
        type: "refEdge" as const,
        animated: false,
        style: { stroke: "#626468", strokeWidth: 2 },
        markerEnd: { type: MarkerType.Arrow, color: "#626468", strokeWidth: 2 },
        data: {
          refId: ref.id,
          onDelete: readonly ? undefined : onEdgeDelete,
        },
      })),
    [data.refs, onEdgeDelete, readonly],
  )

  // relatedCols: recalculates when refs change, used for column sort order in
  // collapsed nodes. Updated in displayNodes without touching node positions.
  const relatedColsMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const ref of data.refs) {
      if (!map.has(ref.fromTable)) map.set(ref.fromTable, new Set())
      if (!map.has(ref.toTable)) map.set(ref.toTable, new Set())
      map.get(ref.fromTable)?.add(ref.fromCol)
      map.get(ref.toTable)?.add(ref.toCol)
    }
    return map
  }, [data.refs])

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutData.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedEdges)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  // Always tracks the latest node positions without stale closure issues.
  const nodesRef = useRef(nodes)
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (animationRef.current !== null)
        cancelAnimationFrame(animationRef.current)
    }
  }, [])

  const animateToLayout = useCallback(
    (targetNodes: typeof nodes) => {
      if (animationRef.current !== null)
        cancelAnimationFrame(animationRef.current)

      const startPositions = new Map(
        nodesRef.current.map((n) => [n.id, { ...n.position }]),
      )
      const startTime = performance.now()

      const tick = (now: number) => {
        const t = ease(Math.min((now - startTime) / LAYOUT_DURATION, 1))

        // flushSync forces a synchronous render each frame so edge paths
        // update in step with node positions — no more edge snap-ahead.
        flushSync(() => {
          setNodes(
            targetNodes.map((node) => {
              const start = startPositions.get(node.id) ?? node.position
              return {
                ...node,
                position: {
                  x: start.x + (node.position.x - start.x) * t,
                  y: start.y + (node.position.y - start.y) * t,
                },
              }
            }),
          )
        })

        if (t < 1) {
          animationRef.current = requestAnimationFrame(tick)
        } else {
          animationRef.current = null
        }
      }

      animationRef.current = requestAnimationFrame(tick)
    },
    [setNodes],
  )

  // Animate nodes to new layout only when tables change.
  useEffect(() => {
    animateToLayout(layoutData.nodes)
    setSelectedEdgeId(null)
  }, [layoutData.nodes, animateToLayout])

  // Update edges when refs change — node positions are untouched.
  useEffect(() => {
    setEdges(computedEdges)
    setSelectedEdgeId(null)
  }, [computedEdges, setEdges])

  // Auto-arrange: re-layout when refs change (or when toggled on).
  // Skips the initial mount since layoutData already handles that.
  const isFirstAutoArrangeRun = useRef(true)
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional skip of first run
  useEffect(() => {
    if (isFirstAutoArrangeRun.current) {
      isFirstAutoArrangeRun.current = false
      return
    }
    if (!autoArrange) return
    const baseNodes: CustomNodeType[] = data.tables.map((table) => ({
      id: table.name,
      type: "tableNode" as const,
      data: { table, relatedCols: new Set<string>() },
      position: { x: 0, y: 0 },
    }))
    const { nodes: arrangedNodes } = getLayoutedElements(
      baseNodes,
      computedEdges,
      data.tables,
    )
    animateToLayout(arrangedNodes)
  }, [autoArrange, data.refs])

  // Reset collapse state only when the table list itself changes.
  useEffect(() => {
    setCollapsedTables(
      new Set(
        data.tables
          .filter((t) => t.columns.length > COLLAPSE_THRESHOLD)
          .map((t) => t.name),
      ),
    )
  }, [data.tables])

  const onEdgeSelect = useCallback(
    (edgeId: string) => {
      setSelectedEdgeId((prev) => {
        const next = prev === edgeId ? null : edgeId
        setEdges((eds) =>
          eds.map((e) => ({
            ...e,
            markerEnd: {
              type: MarkerType.Arrow,
              color: e.id === next ? "#4DA6A6" : "#626468",
              strokeWidth: 2,
            },
          })),
        )
        return next
      })
      const next = selectedEdgeId === edgeId ? null : edgeId
      onEdgeSelectProp?.(next)
    },
    [setEdges, onEdgeSelectProp, selectedEdgeId],
  )

  // Clear selection when the selected edge is deleted
  useEffect(() => {
    if (selectedEdgeId && !edges.some((e) => e.id === selectedEdgeId)) {
      setSelectedEdgeId(null)
      onEdgeSelectProp?.(null)
    }
  }, [edges, selectedEdgeId, onEdgeSelectProp])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readonly) return
      if (
        !connection.source ||
        !connection.target ||
        !connection.sourceHandle ||
        !connection.targetHandle
      )
        return
      onEdgeCreate?.(connection)
    },
    [onEdgeCreate, readonly],
  )

  const displayEdges = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        data: {
          ...e.data,
          isSelected: e.id === selectedEdgeId,
          onSelect: onEdgeSelect,
        },
      })),
    [edges, selectedEdgeId, onEdgeSelect],
  )

  const displayNodes = useMemo(() => {
    const selectedEdge = selectedEdgeId
      ? (edges.find((e) => e.id === selectedEdgeId) ?? null)
      : null
    return nodes.map((n,index) => {
      let selectedRefCols: Set<string> | undefined
      if (selectedEdge) {
        if (n.id === selectedEdge.source && selectedEdge.sourceHandle) {
          selectedRefCols = new Set([selectedEdge.sourceHandle])
        } else if (n.id === selectedEdge.target && selectedEdge.targetHandle) {
          selectedRefCols = new Set([selectedEdge.targetHandle])
        }
      }
      return {
        ...n,
        data: {
          ...n.data,
          dataTestId:`schema-table-visualizer-${index}`,
          relatedCols: relatedColsMap.get(n.id) ?? new Set<string>(),
          cachedColumns,
          onColumnToggle: readonly ? undefined : onColumnToggle,
          isCollapsed: collapsedTables.has(n.id),
          onToggleCollapse,
          selectedRefCols,
        },
      }
    })
  }, [
    nodes,
    collapsedTables,
    onToggleCollapse,
    selectedEdgeId,
    edges,
    relatedColsMap,
    cachedColumns,
    onColumnToggle,
    readonly,
  ])

  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={containerRef} className="flex-1 h-full relative bg-background">
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={readonly ? undefined : onConnect}
        // biome-ignore lint/suspicious/noExplicitAny: ReactFlow's connectionLineComponent type is overly strict
        connectionLineComponent={readonly ? undefined : (ConnectionLine as any)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        proOptions={{ hideAttribution: true }}
        className="bg-white"
        minZoom={0.1}
        maxZoom={4}
        nodesDraggable={!readonly}
        nodesConnectable={!readonly}
        elementsSelectable={!readonly}
      >
        <VisualizerControls
          containerRef={containerRef}
          fullscreenRef={fullscreenRef}
          sidebarCollapsed={sidebarCollapsed}
        />
        <Background />
      </ReactFlow>
    </div>
  )
}
