"use client";
import React, { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic"; // 1. Import dynamic
import {
  Database,
  Save,
  RotateCcw,
  Lock,
  LockOpen,
  Loader2,
} from "lucide-react";
import { parseSchema } from "./lib/parser";
import { SchemaRef } from "./lib/types";

// 2. Dynamically import heavy Client-side components
// This replaces the normal static imports
const MonacoWrapper = dynamic(
  () =>
    import("./components/Editor/MonacoWrapper").then(
      (mod) => mod.MonacoWrapper
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center text-slate-500">
        <Loader2 className="animate-spin" />
      </div>
    ),
  }
);

const Canvas = dynamic(
  () => import("./components/SchemaCanvas/Canvas").then((mod) => mod.Canvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 bg-slate-950 flex items-center justify-center text-slate-500">
        Loading Canvas...
      </div>
    ),
  }
);

interface SchemaBuilderProps {
  initialSchema: string;
  onSave: (schema: string) => Promise<void>;
  readOnly?: boolean;
}

export const SchemaBuilder: React.FC<SchemaBuilderProps> = ({
  initialSchema,
  onSave,
  readOnly: initialReadOnly = false,
}) => {
  const [code, setCode] = useState<string>(initialSchema);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(initialReadOnly);

  // No need for 'mounted' state anymore!

  const schemaData = useMemo(() => parseSchema(code), [code]);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(code);
    setIsSaving(false);
  };

  const handleRemoveRef = useCallback(
    (ref: SchemaRef) => {
      if (isLocked) return;
      setCode((prevCode) => {
        const pattern = new RegExp(
          `--\\s*Ref:\\s*["\`]?${ref.fromTable}["\`]?\\.["\`]?${ref.fromCol}["\`]?\\s*[>=<\\-]\\s*["\`]?${ref.toTable}["\`]?\\.["\`]?${ref.toCol}["\`]?.*(\\r\\n|\\r|\\n)?`,
          "gi"
        );
        return prevCode.replace(pattern, "").trim();
      });
    },
    [isLocked]
  );

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200 font-sans overflow-hidden">
      {/* Sidebar / Editor */}
      <div className="w-[450px] flex flex-col border-r border-slate-800 bg-slate-900 z-10 shadow-2xl flex-shrink-0">
        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 text-blue-400 font-bold">
            <Database size={20} /> SchemaVis
          </div>
          <div className="flex gap-2 items-center">
            {/* Lock Button */}
            <button
              onClick={() => setIsLocked(!isLocked)}
              className={`p-2 rounded transition-colors ${
                isLocked
                  ? "bg-amber-500/10 text-amber-500"
                  : "text-slate-500 hover:bg-slate-800"
              }`}
              title={isLocked ? "Unlock Editor" : "Lock Editor"}
            >
              {isLocked ? <Lock size={16} /> : <LockOpen size={16} />}
            </button>

            <div className="h-4 w-px bg-slate-700 mx-1" />

            <button
              onClick={() => setCode(initialSchema)}
              disabled={isLocked}
              className="p-2 hover:bg-slate-800 rounded text-slate-400 disabled:opacity-30 transition-colors"
              title="Reset"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isLocked}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-bold flex gap-2 items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save size={14} /> {isSaving ? "Saving..." : "Update"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
          <MonacoWrapper
            value={code}
            onChange={setCode}
            readOnly={isLocked}
            schemaTables={schemaData.tables}
          />
          {isLocked && (
            <div className="absolute top-2 right-4 pointer-events-none flex items-center gap-2 text-xs text-amber-500 font-mono opacity-80 z-50">
              <Lock size={12} /> Read Only
            </div>
          )}
        </div>

        {schemaData.error && (
          <div className="bg-red-900/90 text-red-100 p-3 text-xs border-t border-red-700 break-words flex items-start gap-2 shadow-inner">
            <span className="font-bold">Error:</span> {schemaData.error}
          </div>
        )}
      </div>

      {/* Visualizer */}
      <Canvas
        data={schemaData}
        onAddRef={(ref) => setCode((prev) => prev + ref)}
        onRemoveRef={handleRemoveRef}
        readOnly={isLocked}
      />
    </div>
  );
};
