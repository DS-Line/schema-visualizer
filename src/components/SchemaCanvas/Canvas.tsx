"use client";

import {
  Background,
  Connection,
  Controls,
  Edge,
  MarkerType,
  OnSelectionChangeParams,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo } from "react";

import { getLayoutedElements } from "@schema-viz/lib/layout";
import {
  AppNode,
  SchemaData,
  SchemaRef,
  SchemaTable,
} from "@schema-viz/lib/types";

import { CustomEdge } from "./CustomEdge";
import { CustomNode } from "./CustomNode";

interface CanvasProps {
  data: SchemaData;
  onAddRef: (refStr: string) => void;
  onRemoveRef: (ref: SchemaRef) => void;
  onSelectElement: (item: SchemaTable | SchemaRef) => void;
  readOnly?: boolean;
  defaultZoom?: number;
}

export const Canvas = ({
  data,
  onAddRef,
  onRemoveRef,
  onSelectElement,
  readOnly,
  defaultZoom,
}: CanvasProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const nodeTypes = useMemo(() => ({ customTable: CustomNode }), []);
  const edgeTypes = useMemo(() => ({ customEdge: CustomEdge }), []);

  // in react flow, fitView overrides defaultViewport, so only fitView when no defaultZoom is provided
  const shouldFitView = defaultZoom === undefined;
  useEffect(() => {
    const flowNodes: AppNode[] = data.tables.map((table) => ({
      id: table.name,
      type: "customTable",
      data: { table, fetchedCols: data.fetchedCols },
      position: { x: 0, y: 0 },
      dragHandle: ".custom-drag-handle",
    }));

    const flowEdges: Edge[] = data.refs.map((ref) => ({
      id: ref.id,
      type: "customEdge",
      source: ref.fromTable,
      sourceHandle: ref.fromCol,
      target: ref.toTable,
      targetHandle: ref.toCol,
      animated: false,
      deletable: !readOnly && !ref.isSystem,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: ref.isSystem ? "#94a3b8" : "#3b82f6",
      },
      data: {
        isDeletable: !readOnly && !ref.isSystem,
        onDelete: () => onRemoveRef(ref),
      },
    }));

    const layout = getLayoutedElements(flowNodes, flowEdges, data.tables);
    setNodes(layout.nodes);
    setEdges(layout.edges);
  }, [
    data.tables,
    data.refs,
    data.fetchedCols,
    setNodes,
    setEdges,
    readOnly,
    onRemoveRef,
  ]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (readOnly) return;
      if (
        !params.source ||
        !params.target ||
        !params.sourceHandle ||
        !params.targetHandle
      )
        return;

      const exists = data.refs.some((ref) => {
        const sourceTable = params.source!;
        const targetTable = params.target!;
        const sourceCol = params.sourceHandle!;
        const targetCol = params.targetHandle!;

        const isForward =
          ref.fromTable === sourceTable &&
          ref.fromCol === sourceCol &&
          ref.toTable === targetTable &&
          ref.toCol === targetCol;

        const isBackward =
          ref.fromTable === targetTable &&
          ref.fromCol === targetCol &&
          ref.toTable === sourceTable &&
          ref.toCol === sourceCol;

        return isForward || isBackward;
      });

      if (exists) {
        console.log("Connection already exists in schema.");
        return;
      }

      const newRef = `\n-- Ref: ${params.source}.${params.sourceHandle} > ${params.target}.${params.targetHandle}`;
      onAddRef(newRef);
    },
    [data.refs, onAddRef, readOnly]
  );

  const onSelectionChange = useCallback(
    ({ nodes, edges }: OnSelectionChangeParams) => {
      if (nodes.length === 1) {
        const table = data.tables.find((t) => t.name === nodes[0].id);
        if (table) onSelectElement(table);
      } else if (edges.length === 1) {
        const ref = data.refs.find((r) => r.id === edges[0].id);
        if (ref) onSelectElement(ref);
      }
    },
    [data.tables, data.refs, onSelectElement]
  );

  return (
    <div className="flex-1 h-full bg-gray-50 relative group">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView={shouldFitView}
        defaultViewport={
          defaultZoom ? { x: 25, y: 75, zoom: defaultZoom } : undefined
        }
        minZoom={0.1}
        maxZoom={2}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={true} // Change to false to disable select in readOnly
        proOptions={{ hideAttribution: true }}
        className="bg-gray-50"
      >
        <Background color="#fefefe" />

        <Controls
          showInteractive={false}
          className="bg-white border-gray-200 shadow-md fill-gray-600"
        />
      </ReactFlow>

      {readOnly && (
        <div className="absolute top-4 right-4 z-50 bg-white/90 border border-amber-500 text-amber-600 px-3 py-1.5 rounded-full text-xs font-bold pointer-events-none backdrop-blur-sm flex items-center gap-2 shadow-sm">
          <span>Read Only</span>
        </div>
      )}
    </div>
  );
};
