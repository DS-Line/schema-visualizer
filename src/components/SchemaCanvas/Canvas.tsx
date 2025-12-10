"use client";
import React, { useState, useEffect, useRef } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import {
  SchemaData,
  NodePosition,
  DraggingState,
  ConnectingState,
  SchemaRef,
} from "@/lib/types";
import { Node } from "./Node";
import { RelationshipLine } from "./RelationshipLine";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // Canvas State
  const [positions, setPositions] = useState<Record<string, NodePosition>>(
    () => {
      const initialPositions: Record<string, NodePosition> = {};
      data.nodes.forEach((n, i) => {
        initialPositions[n.name] = {
          x: 50 + (i % 3) * 320,
          y: 50 + Math.floor(i / 3) * 320,
        };
      });
      return initialPositions;
    }
  );
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Interaction State
  const [dragging, setDragging] = useState<DraggingState | null>(null);
  const [connecting, setConnecting] = useState<ConnectingState | null>(null);
  const [panStart, setPanStart] = useState<{
    x: number;
    y: number;
    origX: number;
    origY: number;
  } | null>(null);

  // Initialize Positions
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
  }, []);

  // Global Mouse Listeners (for smooth dragging outside container)
  useEffect(() => {
    if (!dragging && !connecting && !panStart) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      // 1. Pan Canvas
      if (panStart) {
        setOffset({
          x: panStart.origX + (e.clientX - panStart.x),
          y: panStart.origY + (e.clientY - panStart.y),
        });
        return;
      }

      // 2. Drag Node
      if (dragging) {
        const dx = (e.clientX - dragging.mouseX) / scale;
        const dy = (e.clientY - dragging.mouseY) / scale;
        setPositions((prev) => ({
          ...prev,
          [dragging.name]: { x: dragging.origX + dx, y: dragging.origY + dy },
        }));
        return;
      }

      // Connect Nodes
      if (connecting) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          setConnecting((prev) =>
            prev
              ? {
                  ...prev,
                  currX: (e.clientX - rect.left - offset.x) / scale,
                  currY: (e.clientY - rect.top - offset.y) / scale,
                }
              : null
          );
        }
      }
    };

    const handleWindowMouseUp = () => {
      setDragging(null);
      setConnecting(null);
      setPanStart(null);
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [dragging, connecting, panStart, scale, offset]);

  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 1) {
      setPanStart({
        x: e.clientX,
        y: e.clientY,
        origX: offset.x,
        origY: offset.y,
      });
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, name: string) => {
    if (readOnly) return;
    e.stopPropagation();
    setDragging({
      name,
      mouseX: e.clientX,
      mouseY: e.clientY,
      origX: positions[name]?.x || 0,
      origY: positions[name]?.y || 0,
    });
  };

  const handleConnectStart = (
    e: React.MouseEvent,
    table: string,
    col: string
  ) => {
    if (readOnly) return;
    e.stopPropagation();
    const pos = positions[table];
    const node = data.nodes.find((n) => n.name === table);
    if (!pos || !node) return;

    const colIdx = node.columns.findIndex((c) => c.name === col);
    const ROW_HEIGHT = 40;
    const HEADER_HEIGHT = 48;
    const startX = pos.x + 256;
    const startY = pos.y + HEADER_HEIGHT + colIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

    setConnecting({
      startTable: table,
      startCol: col,
      startX,
      startY,
      currX: startX,
      currY: startY,
    });
  };

  const handleConnectEnd = (
    e: React.MouseEvent,
    targetTable: string,
    targetCol: string
  ) => {
    e.stopPropagation();

    if (connecting && connecting.startTable !== targetTable) {
      const alreadyExists = data.refs.some((ref) => {
        const isForward =
          ref.fromTable === connecting.startTable &&
          ref.fromCol === connecting.startCol &&
          ref.toTable === targetTable &&
          ref.toCol === targetCol;
        const isBackward =
          ref.fromTable === targetTable &&
          ref.fromCol === targetCol &&
          ref.toTable === connecting.startTable &&
          ref.toCol === connecting.startCol;
        return isForward || isBackward;
      });

      if (!alreadyExists) {
        const newRef = `\n-- Ref: ${connecting.startTable}.${connecting.startCol} > ${targetTable}.${targetCol}`;
        onAddRef(newRef);
      }
    }
    setConnecting(null);
  };

  const getConnectorPoints = (ref: SchemaRef) => {
    const fromPos = positions[ref.fromTable];
    const toPos = positions[ref.toTable];
    const fromNode = data.nodes.find((n) => n.name === ref.fromTable);
    const toNode = data.nodes.find((n) => n.name === ref.toTable);

    if (!fromPos || !toPos || !fromNode || !toNode) return null;

    const fromIdx = fromNode.columns.findIndex((c) => c.name === ref.fromCol);
    const toIdx = toNode.columns.findIndex((c) => c.name === ref.toCol);

    // If column doesn't exist (index -1), returns NULL to hide line
    if (fromIdx === -1 || toIdx === -1) return null;

    const ROW_HEIGHT = 40;
    const HEADER_HEIGHT = 48;
    const TABLE_WIDTH = 256;

    const y1 =
      fromPos.y + HEADER_HEIGHT + fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
    const y2 = toPos.y + HEADER_HEIGHT + toIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

    let x1, x2;
    if (fromPos.x < toPos.x) {
      x1 = fromPos.x + TABLE_WIDTH;
      x2 = toPos.x;
    } else {
      x1 = fromPos.x;
      x2 = toPos.x + TABLE_WIDTH;
    }

    return { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } };
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-slate-950 relative overflow-hidden cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDownCanvas}
      onWheel={(e) => {
        if (e.ctrlKey) {
          e.preventDefault();
          setScale((s) =>
            Math.min(Math.max(s + (e.deltaY > 0 ? -0.1 : 0.1), 0.5), 2)
          );
        }
      }}
    >
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#475569 1px, transparent 1px)",
          backgroundSize: `${20 * scale}px ${20 * scale}px`,
          transform: `translate(${offset.x}px, ${offset.y}px)`,
        }}
      />

      <div className="absolute top-4 right-4 flex flex-col gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700 shadow-xl z-50">
        <button
          onClick={() => setScale((s) => Math.min(s + 0.1, 2))}
          className="p-2 hover:bg-slate-700 rounded text-slate-300"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={() => setScale(1)}
          className="p-2 hover:bg-slate-700 rounded text-xs font-mono text-slate-300"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          onClick={() => setScale((s) => Math.max(s - 0.1, 0.5))}
          className="p-2 hover:bg-slate-700 rounded text-slate-300"
        >
          <ZoomOut size={18} />
        </button>
      </div>

      <div
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: "0 0",
          width: "100%",
          height: "100%",
        }}
        className="relative w-full h-full"
      >
        <svg className="absolute top-0 left-0 w-[5000px] h-[5000px] pointer-events-none overflow-visible z-0">
          {data.refs.map((ref) => {
            const points = getConnectorPoints(ref);
            if (!points) return null;
            return (
              <RelationshipLine
                key={ref.id}
                start={points.start}
                end={points.end}
                // only pass onDelete if it is NOT a system ref
                onDelete={
                  ref.isSystem || readOnly ? undefined : () => onRemoveRef(ref)
                }
              />
            );
          })}

          {connecting && (
            <RelationshipLine
              start={{ x: connecting.startX, y: connecting.startY }}
              end={{ x: connecting.currX, y: connecting.currY }}
              isTemp={true}
            />
          )}
        </svg>

        {data.nodes.map((node) => (
          <Node
            key={node.name}
            data={node}
            x={positions[node.name]?.x || 0}
            y={positions[node.name]?.y || 0}
            isActive={dragging?.name === node.name}
            fetchedCols={data.fetchedCols}
            onMouseDown={handleNodeMouseDown}
            onConnectStart={handleConnectStart}
            onConnectEnd={handleConnectEnd}
          />
        ))}
      </div>
    </div>
  );
};
