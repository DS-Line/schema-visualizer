"use client";
import {
  Database,
  Loader2,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Save,
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
      <div className="h-full w-full flex items-center justify-center">
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

const MIN_SIDEBAR_WIDTH = 300;
const MAX_SIDEBAR_WIDTH = 800;
const DEFAULT_SIDEBAR_WIDTH = 450;

export const SchemaBuilder = ({
  initialSchema,
  onSave,
  readOnly = false,
}: SchemaBuilderProps) => {
  const [code, setCode] = useState<string>(initialSchema);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Sidebar State
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const schemaData = useMemo(() => parseSchema(code), [code]);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(code);
    setIsSaving(false);
  };

  const handleRemoveRef = useCallback(
    (ref: SchemaRef) => {
      if (readOnly) return;
      setCode((prevCode) => {
        const pattern = new RegExp(
          `--\\s*Ref:\\s*["\`]?${ref.fromTable}["\`]?\\.["\`]?${ref.fromCol}["\`]?\\s*[>=<\\-]\\s*["\`]?${ref.toTable}["\`]?\\.["\`]?${ref.toCol}["\`]?.*(\\r\\n|\\r|\\n)?`,
          "gi"
        );
        return prevCode.replace(pattern, "").trim();
      });
    },
    [readOnly]
  );

  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing && sidebarRef.current) {
        const newWidth =
          mouseMoveEvent.clientX -
          sidebarRef.current.getBoundingClientRect().left;
        if (newWidth < 100) {
          setIsCollapsed(true);
          setIsResizing(false);
        } else {
          if (isCollapsed) setIsCollapsed(false);
          setSidebarWidth(
            Math.min(Math.max(newWidth, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH)
          );
        }
      }
    },
    [isResizing, isCollapsed]
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    }
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  return (
    <div
      ref={sidebarRef}
      className="flex flex-row h-full w-full bg-slate-950 text-slate-200 font-sans overflow-hidden border border-slate-800 rounded-lg shadow-sm relative select-none"
    >
      {/* 1. LEFT SIDEBAR */}
      <div
        style={{ width: isCollapsed ? 0 : sidebarWidth }}
        className={`flex flex-col bg-slate-900 z-10 flex-shrink-0 relative transition-all duration-75 ease-linear 
          ${isResizing ? "pointer-events-none select-none" : ""}
          ${isCollapsed ? "border-none" : "border-r border-slate-800"} 
        `}
      >
        {/* Only render content if NOT collapsed */}
        {!isCollapsed && (
          <>
            <div className="h-12 flex items-center justify-between px-3 border-b border-slate-800 shrink-0 overflow-hidden">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-sm truncate">
                <Database size={18} />
                <span className="hidden sm:inline">SchemaVis</span>
              </div>
              <div className="flex gap-2 items-center">
                {/* Save Button */}
                <button
                  onClick={handleSave}
                  disabled={isSaving || readOnly}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-bold flex gap-2 items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Save changes"
                >
                  {isSaving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  {isSaving ? "Saving" : "Update"}
                </button>

                <div className="h-4 w-px bg-slate-700 mx-1" />

                <button
                  onClick={() => setCode(initialSchema)}
                  disabled={readOnly}
                  className="p-1.5 hover:bg-slate-800 rounded text-slate-400 disabled:opacity-30 transition-colors"
                  title="Reset"
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  onClick={() => setIsCollapsed(true)}
                  className="p-1.5 hover:bg-slate-800 rounded text-slate-400 transition-colors"
                  title="Collapse Editor"
                >
                  <PanelLeftClose size={14} />
                </button>
              </div>
            </div>

            {/* Editor Content */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
              <div className="flex-1 relative">
                <MonacoWrapper
                  value={code}
                  onChange={setCode}
                  readOnly={readOnly}
                  schemaTables={schemaData.tables}
                  validationErrors={schemaData.errors}
                />
                {readOnly && (
                  <div className="absolute top-2 right-4 pointer-events-none flex items-center gap-2 text-xs text-amber-500 font-mono opacity-80 z-50">
                    <Lock size={12} /> Read Only
                  </div>
                )}
              </div>

              {/* Error Count Footer */}
              {schemaData.errors.length > 0 && (
                <div className="bg-red-900/20 text-red-200 px-3 py-2 text-xs border-t border-red-900/50 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="font-semibold">
                      {schemaData.errors.length} Issue
                      {schemaData.errors.length > 1 ? "s" : ""} found
                    </span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 2. DRAG HANDLE */}
      {!isCollapsed && (
        <div
          className="w-1 bg-slate-800 hover:bg-blue-500 cursor-col-resize z-20 flex items-center justify-center group transition-colors delay-75 hover:delay-0 active:bg-blue-600"
          onMouseDown={startResizing}
        >
          <div className="h-8 w-1 bg-slate-600 rounded-full group-hover:bg-white transition-colors" />
        </div>
      )}

      {/* 3. VISUALIZER */}
      <div className="flex-1 h-full min-w-0 relative bg-slate-950">
        {isCollapsed && (
          <button
            onClick={() => setIsCollapsed(false)}
            className="absolute top-4 left-4 z-50 bg-slate-800 border border-slate-700 text-slate-300 p-2 rounded-lg shadow-xl hover:bg-slate-700 hover:text-white transition-all hover:scale-105 active:scale-95"
            title="Expand Editor"
          >
            <PanelLeftOpen size={20} />
          </button>
        )}

        <Canvas
          data={schemaData}
          onAddRef={(ref) => setCode((prev) => prev + ref)}
          onRemoveRef={handleRemoveRef}
          readOnly={readOnly}
        />
      </div>

      {/* Overlay for resizing */}
      {isResizing && (
        <div className="fixed inset-0 z-[9999] cursor-col-resize" />
      )}
    </div>
  );
};
