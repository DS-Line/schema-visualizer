"use client";
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
} from "@xyflow/react";
import { X } from "lucide-react";
import React from "react";

export const CustomEdge = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) => {
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

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {/* Only show delete button if explicitly allowed */}
      {data?.isDeletable && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity"
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
