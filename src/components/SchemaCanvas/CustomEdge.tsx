"use client";
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
} from "@xyflow/react";
import { X } from "lucide-react";
import React, { useState } from "react";


export const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
}: EdgeProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeClick = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    if (data?.onDelete && typeof data.onDelete === "function") {
      data.onDelete();
    }
  };

  const isSystem = id.startsWith("sys-");

  // Todo: Update this Color
  let strokeColor = isSystem ? "#94a3b8" : "#3b82f6"; // Default
  if (selected) {
    strokeColor = isSystem ? "#475569" : "#2563eb"; // Selected (Darker)
  } else if (isHovered) {
    strokeColor = isSystem ? "#cbd5e1" : "#60a5fa"; // Hover (Lighter)
  }

  const combinedStyle = {
    ...style,
    stroke: strokeColor,
    strokeWidth: selected || isHovered ? 3 : 2,
    transition: "stroke 0.2s, stroke-width 0.2s",
  };

  return (
    <>
      {/* Invisible wider path for better hover interaction */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="react-flow__edge-interaction"
      />
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={combinedStyle} />

      {data?.isDeletable && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className={`${
              isHovered || selected ? "opacity-100" : "opacity-0"
            } transition-opacity`}
            onMouseEnter={() => setIsHovered(true)}
          >
            <button
              className="bg-gray-100 border border-red-500 rounded-full p-1 text-red-500 hover:bg-red-500 hover:text-white transition-colors shadow-sm cursor-pointer"
              onClick={onEdgeClick}
              title="Delete Relationship"
            >
              <X size={12} />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};
