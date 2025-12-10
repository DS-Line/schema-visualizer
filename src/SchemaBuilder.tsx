"use client";
import React, { useState, useMemo, useCallback } from "react";
import { MonacoWrapper } from "./components/Editor/MonacoWrapper";
import { Canvas } from "./components/SchemaCanvas/Canvas";
import { parseSchema } from "./lib/parser";
import { Database, Save, RotateCcw } from "lucide-react";
import { SchemaRef } from "./lib/types";

interface SchemaBuilderProps {
  initialSchema: string;
  onSave: (schema: string) => Promise<void>;
  readOnly?: boolean;
}

export const SchemaBuilder: React.FC<SchemaBuilderProps> = ({
  initialSchema,
  onSave,
  readOnly = false,
}) => {
  const [code, setCode] = useState<string>(initialSchema);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const schemaData = useMemo(() => parseSchema(code), [code]);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(code);
    setIsSaving(false);
  };

  // 1. Logic to remove a line from the editor
  const handleRemoveRef = useCallback((ref: SchemaRef) => {
    setCode((prevCode) => {
      // Regex to find: -- Ref: table.col > table.col
      // flexible with spacing and optional quotes
      const pattern = new RegExp(
        `--\\s*Ref:\\s*["\`]?${ref.fromTable}["\`]?\\.["\`]?${ref.fromCol}["\`]?\\s*[>=<\\-]\\s*["\`]?${ref.toTable}["\`]?\\.["\`]?${ref.toCol}["\`]?.*(\\r\\n|\\r|\\n)?`,
        "gi"
      );
      return prevCode.replace(pattern, "").trim(); // Remove line and trim extra whitespace
    });
  }, []);

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200 font-sans">
      {/* Sidebar / Editor */}
      <div className="w-[450px] flex flex-col border-r border-slate-800 bg-slate-900 z-10 shadow-2xl flex-shrink-0">
        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 text-blue-400 font-bold">
            <Database size={20} /> Schema Visualizer
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCode(initialSchema)}
              className="p-2 hover:bg-slate-800 rounded text-slate-400 transition-colors cursor-pointer"
              title="Reset"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || readOnly}
              className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-bold flex gap-2 items-center disabled:opacity-50 transition-colors disabled:cursor-default"
            >
              <Save size={14} /> {isSaving ? "Saving..." : "Update"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <MonacoWrapper
            value={code}
            onChange={setCode}
            readOnly={readOnly}
            schemaNodes={schemaData.nodes}
          />
        </div>

        {schemaData.error && (
          <div className="bg-red-900/50 text-red-200 p-2 text-xs border-t border-red-800 break-words">
            {schemaData.error}
          </div>
        )}
      </div>

      {/* Visualizer */}
      <Canvas
        data={schemaData}
        onAddRef={(ref) => setCode((prev) => prev + ref)}
        onRemoveRef={handleRemoveRef}
        readOnly={readOnly}
      />
    </div>
  );
};
