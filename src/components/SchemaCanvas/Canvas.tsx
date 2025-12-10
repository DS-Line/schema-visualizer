"use client";
import React, { useEffect, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  MarkerType,
  NodeTypes,
  EdgeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { SchemaData, SchemaRef, AppNode } from "@/lib/types";
import { getLayoutedElements } from "@/lib/layout";
import { CustomNode } from "./CustomNode";
import { CustomEdge } from "./CustomEdge";

interface CanvasProps {
  data: SchemaData;
  onAddRef: (refStr: string) => void;
  onRemoveRef: (ref: SchemaRef) => void;
  readOnly?: boolean;
}

export const Canvas: React.FC<CanvasProps> = ({
  data,
  onAddRef,
  onRemoveRef,
  readOnly,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const nodeTypes = useMemo<NodeTypes>(() => ({ customTable: CustomNode }), []);
  const edgeTypes = useMemo<EdgeTypes>(() => ({ customEdge: CustomEdge }), []);

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
      style: { stroke: ref.isSystem ? "#475569" : "#3b82f6", strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: ref.isSystem ? "#475569" : "#3b82f6",
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

      const exists = edges.some(
        (e) =>
          (e.source === params.source &&
            e.target === params.target &&
            e.sourceHandle === params.sourceHandle &&
            e.targetHandle === params.targetHandle) ||
          (e.source === params.target &&
            e.target === params.source &&
            e.sourceHandle === params.targetHandle &&
            e.targetHandle === params.sourceHandle)
      );
      if (exists) return;

      const newRef = `\n-- Ref: ${params.source}.${params.sourceHandle} > ${params.target}.${params.targetHandle}`;
      onAddRef(newRef);
    },
    [edges, onAddRef, readOnly]
  );

  return (
    <div className="flex-1 h-full bg-slate-950 relative group">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        proOptions={{ hideAttribution: true }}
        className="bg-slate-950"
      >
        <Background color="#334155" gap={20} size={1} />

        {/* UPDATED CONTROLS: Removed the interactive lock button */}
        <Controls
          className="bg-slate-800 border-slate-700 fill-slate-200"
          showInteractive={false}
        />
      </ReactFlow>

      {readOnly && (
        <div className="absolute top-4 left-4 z-50 bg-slate-900/80 border border-amber-500/50 text-amber-500 px-3 py-1.5 rounded-full text-xs font-bold pointer-events-none backdrop-blur-sm flex items-center gap-2">
          <span>Locked</span>
        </div>
      )}
    </div>
  );
};
