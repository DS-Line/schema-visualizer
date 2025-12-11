"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";

import { Database, Loader2, Lock, RotateCcw, Save } from "lucide-react";

import { parseSchema } from "./lib/parser";
import { SchemaRef } from "./lib/types";

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
      <div className="h-full flex items-center justify-center text-slate-500">
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

export const SchemaBuilder = ({
  initialSchema,
  onSave,
  readOnly = false,
}: SchemaBuilderProps) => {
  const [code, setCode] = useState<string>(initialSchema);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const isLocked = readOnly;

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
    <div className="flex flex-row h-full w-full bg-slate-950 text-slate-200 font-sans overflow-hidden border border-slate-800 rounded-lg shadow-sm">
      {/* Sidebar / Editor */}
      <div className="w-[400px] flex flex-col border-r border-slate-800 bg-slate-900 z-10 flex-shrink-0">
        <div className="h-12 flex items-center justify-between px-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
            <Database size={18} /> SchemaVis
          </div>
          <div className="flex gap-1 items-center">
            <button
              onClick={() => setCode(initialSchema)}
              disabled={isLocked}
              className="p-1.5 hover:bg-slate-800 rounded text-slate-400 disabled:opacity-30 transition-colors"
              title="Reset"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isLocked}
              className="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded text-xs font-bold flex gap-1 items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save size={14} /> {isSaving ? "Saving" : "Save"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
          <MonacoWrapper
            value={code}
            onChange={setCode}
            readOnly={isLocked}
            schemaTables={schemaData.tables}
            validationErrors={schemaData.errors}
          />
          {isLocked && (
            <div className="absolute top-2 right-4 pointer-events-none flex items-center gap-2 text-xs text-amber-500 font-mono opacity-80 z-50">
              <Lock size={12} /> Read Only
            </div>
          )}
        </div>

        {/* Error Count Footer */}
        {schemaData.errors.length > 0 && (
          <div className="bg-red-900/20 text-red-200 px-3 py-1 text-xs border-t border-red-900/50 flex justify-between items-center">
            <span>
              {schemaData.errors.length} Issue
              {schemaData.errors.length > 1 ? "s" : ""} found
            </span>
          </div>
        )}
      </div>

      {/* Visualizer */}
      <div className="flex-1 h-full min-w-0">
        <Canvas
          data={schemaData}
          onAddRef={(ref) => setCode((prev) => prev + ref)}
          onRemoveRef={handleRemoveRef}
          readOnly={isLocked}
        />
      </div>
    </div>
  );
};
