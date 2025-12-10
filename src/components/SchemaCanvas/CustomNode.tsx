"use client";
import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import {
  Database,
  Eye,
  Key,
  Link as LinkIcon,
  ArrowDownToLine,
} from "lucide-react";
import { CustomNodeType } from "@/lib/types";

export const CustomNode = memo(
  ({ data, selected }: NodeProps<CustomNodeType>) => {
    const { table, fetchedCols } = data;
    const isView = table.type === "view";

    return (
      <div
        className={`
      w-[280px] bg-slate-800 rounded-lg shadow-xl border overflow-hidden
      transition-shadow duration-200
      ${
        selected
          ? "border-blue-500 ring-2 ring-blue-500/50"
          : "border-slate-700"
      }
    `}
      >
        {/* Header - Drag Handle */}
        <div
          className={`
        custom-drag-handle 
        px-4 py-3 flex items-center gap-2 border-b border-slate-700/50 cursor-grab active:cursor-grabbing
        ${isView ? "bg-teal-900/40" : "bg-slate-900"}
      `}
        >
          {isView ? (
            <Eye size={14} className="text-teal-400" />
          ) : (
            <Database size={14} className="text-blue-400" />
          )}
          <span className="font-bold text-slate-100 truncate pointer-events-none">
            {table.name}
          </span>
        </div>

        {/* Columns */}
        <div className="flex flex-col bg-slate-800">
          {table.columns.length === 0 && (
            <div className="p-4 text-xs text-slate-500 italic text-center">
              (Implicit/View)
            </div>
          )}

          {table.columns.map((col) => {
            // Robust Set check
            const isFetched =
              fetchedCols instanceof Set
                ? fetchedCols.has(`${table.name}.${col.name}`)
                : false;
            const handleId = col.name;

            return (
              <div
                key={col.name}
                className="relative group flex items-center justify-between px-4 py-2 hover:bg-slate-700/50 border-b border-slate-700/30 last:border-0"
              >
                {/* --- LEFT HANDLE (Target) --- */}
                {/* Large hit area, small visible dot */}
                <Handle
                  type="target"
                  position={Position.Left}
                  id={handleId}
                  className="!w-full !h-full !rounded-none !border-none !bg-transparent !top-0 !bottom-0 !left-0 !transform-none z-10"
                >
                  {/* <div className="absolute top-1/2 left-0 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" /> */}
                </Handle>

                {/* Column Content */}
                <div className="flex items-center gap-2 overflow-hidden pointer-events-none pl-2">
                  <div className="min-w-[16px] flex items-center gap-1">
                    {isFetched && (
                      <ArrowDownToLine size={12} className="text-emerald-400" />
                    )}
                    {col.isPk && <Key size={12} className="text-yellow-500" />}
                    {col.isFk && !col.isPk && (
                      <LinkIcon size={12} className="text-blue-400" />
                    )}
                  </div>
                  <span
                    className={`text-sm truncate ${
                      col.isPk ? "text-slate-100 font-medium" : "text-slate-300"
                    }`}
                  >
                    {col.name}
                  </span>
                </div>
                <span className="text-xs text-slate-500 font-mono pointer-events-none pr-2">
                  {col.type}
                </span>

                {/* --- RIGHT HANDLE (Source) --- */}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={handleId}
                  className="!w-full !h-full !rounded-none !border-none !bg-transparent !top-0 !bottom-0 !right-0 !transform-none z-10"
                >
                  {/* <div className="absolute top-1/2 right-0 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" /> */}
                </Handle>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

CustomNode.displayName = "CustomNode";
