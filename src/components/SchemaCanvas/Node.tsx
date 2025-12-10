"use client";
import React from "react";
import {
  GripHorizontal,
  Key,
  Database,
  Eye,
  ArrowDownToLine,
  Link as LinkIcon,
} from "lucide-react";
import { SchemaNode } from "@/lib/types";

interface NodeProps {
  data: SchemaNode;
  x: number;
  y: number;
  isActive: boolean;
  fetchedCols: Set<string>;
  onMouseDown: (e: React.MouseEvent, name: string) => void;
  onConnectStart: (e: React.MouseEvent, table: string, col: string) => void;
  onConnectEnd: (e: React.MouseEvent, table: string, col: string) => void;
}

export const Node: React.FC<NodeProps> = ({
  data,
  x,
  y,
  isActive,
  fetchedCols,
  onMouseDown,
  onConnectStart,
  onConnectEnd,
}) => {
  const isView = data.type === "view";

  // Visual Styles based on Type
  const borderColor = isActive
    ? "border-blue-500 ring-1 ring-blue-500"
    : isView
    ? "border-teal-600"
    : "border-slate-700";

  const headerBg = isView ? "bg-teal-900/40" : "bg-slate-900";
  const headerText = isView ? "text-teal-100" : "text-slate-100";

  return (
    <div
      className={`absolute flex flex-col w-64 bg-slate-800 rounded-lg shadow-xl border ${borderColor} z-10 overflow-visible select-none transition-shadow duration-200`}
      style={{
        left: x,
        top: y,
        boxShadow: isActive
          ? "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)"
          : "",
      }}
    >
      {/* Header */}
      <div
        onMouseDown={(e) => onMouseDown(e, data.name)}
        className={`${headerBg} px-4 py-3 border-b border-slate-700/50 flex justify-between items-center cursor-grab active:cursor-grabbing rounded-t-lg group hover:bg-opacity-80 transition-colors`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {isView ? (
            <Eye size={14} className="text-teal-400" />
          ) : (
            <Database size={14} className="text-blue-400" />
          )}
          <span className={`font-bold truncate ${headerText}`}>
            {data.name}
          </span>
        </div>
        <GripHorizontal
          size={16}
          className="text-slate-500 group-hover:text-slate-300"
        />
      </div>

      {/* Columns */}
      <div className="flex flex-col bg-slate-800 rounded-b-lg">
        {data.columns.length > 0 ? (
          data.columns.map((col, idx) => {
            const isFetched = fetchedCols.has(`${data.name}.${col.name}`);

            return (
              <div
                key={idx}
                className={`flex items-center justify-between px-4 py-2 hover:bg-slate-700 transition-colors border-b border-slate-700/30 last:border-0 group relative cursor-crosshair ${
                  isFetched ? "bg-slate-700/50" : ""
                }`}
                onMouseDown={(e) => onConnectStart(e, data.name, col.name)}
                onMouseUp={(e) => onConnectEnd(e, data.name, col.name)}
              >
                <div className="flex items-center gap-2 overflow-hidden pointer-events-none">
                  <div className="min-w-[16px] flex-shrink-0 flex items-center justify-start gap-1">
                    {isFetched && (
                      <ArrowDownToLine size={12} className="text-emerald-400" />
                    )}
                    {col.isPk && (
                      <Key
                        size={12}
                        className="text-yellow-500 fill-yellow-500/20"
                      />
                    )}
                    {col.isFk && !col.isPk && (
                      <LinkIcon size={12} className="text-blue-400" />
                    )}
                  </div>
                  <span
                    className={`text-sm truncate ${
                      col.isPk
                        ? "text-slate-100 font-medium"
                        : isFetched
                        ? "text-emerald-200 font-medium"
                        : "text-slate-300"
                    }`}
                  >
                    {col.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-mono truncate max-w-[80px] text-right pointer-events-none">
                    {col.type !== "unknown" ? col.type : ""}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-4 text-xs text-slate-500 italic text-center">
            (Implicit Columns)
          </div>
        )}
      </div>
    </div>
  );
};
