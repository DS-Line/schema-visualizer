"use client"

import {
  AlertCircle,
  AlertTriangle,
  Check,
  Copy,
  Database,
  ListRestart,
  Loader2,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Save,
} from "lucide-react"
import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { parseSchema } from "./lib/parser"
import type { SchemaError, SchemaRef, SchemaTable } from "./lib/types"

const MonacoWrapper = dynamic(
  () =>
    import("./components/Editor/MonacoWrapper").then(
      (mod) => mod.MonacoWrapper,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center text-gray-400">
        <Loader2 className="animate-spin" />
      </div>
    ),
  },
)
const Canvas = dynamic(
  () => import("./components/SchemaCanvas/Canvas").then((mod) => mod.Canvas),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center text-gray-400">
        Loading Canvas...
      </div>
    ),
  },
)

interface SchemaBuilderProps {
  initialSchema: string
  onSave: (schema: string) => Promise<void>
  readOnly?: boolean
  defaultCollapsed?: boolean
  defaultZoom?: number
  onGenerate?: (hasContent: boolean) => void
  isGenerating?: boolean
  onDirtyChange?: (isDirty: boolean) => void
  onCodeChange?: (code: string) => void
  onErrorChange?: (errors: SchemaError[]) => void
}

const MIN_SIDEBAR_WIDTH = 300
const MAX_SIDEBAR_WIDTH = 800
const DEFAULT_SIDEBAR_WIDTH = 450

export const SchemaBuilder = ({
  initialSchema,
  onSave,
  readOnly = false,
  defaultCollapsed = false,
  defaultZoom,
  onGenerate,
  isGenerating = false,
  onDirtyChange,
  onCodeChange,
  onErrorChange,
}: SchemaBuilderProps) => {
  const [code, setCode] = useState<string>(initialSchema)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [isCopied, setIsCopied] = useState<boolean>(false)
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false)
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 })
  const [isDirty, setIsDirty] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  const [isResizing, setIsResizing] = useState(false)
  const [highlightRequest, setHighlightRequest] = useState<{
    line: number
    col: number
    ts: number
  } | null>(null)

  const sidebarRef = useRef<HTMLDivElement>(null)
  const schemaData = useMemo(() => parseSchema(code), [code])

  useEffect(() => {
    if (initialSchema !== undefined) {
      setCode(initialSchema)
      setIsDirty(false)
      if (onDirtyChange) onDirtyChange(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSchema])

  const hasContent = code.trim().length > 0
  // schema throws empty warning only if the initial schema was not empty
  const isInvalidEmpty =
    !hasContent && (isDirty || initialSchema.trim().length > 0)

  // Combine parser errors with the potential empty error
  const effectiveErrors = useMemo(() => {
    const errs = [...schemaData.errors]
    if (isInvalidEmpty) {
      errs.unshift({
        message: "Schema cannot be empty",
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
      })
    }
    return errs
  }, [schemaData.errors, isInvalidEmpty])

  useEffect(() => {
    const dirty = code.trim() !== initialSchema.trim()
    setIsDirty(dirty)
    if (onDirtyChange) onDirtyChange(dirty)
    if (onCodeChange) onCodeChange(code)
    if (onErrorChange) onErrorChange(effectiveErrors)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, initialSchema, effectiveErrors])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(code)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy", err)
    }
  }

  const handleRemoveRef = useCallback(
    (ref: SchemaRef) => {
      if (readOnly) return
      setCode((prevCode) => {
        const pattern = new RegExp(
          `--\\s*Ref:\\s*["\`]?${ref.fromTable}["\`]?\\.["\`]?${ref.fromCol}["\`]?\\s*[>=<\\-]\\s*["\`]?${ref.toTable}["\`]?\\.["\`]?${ref.toCol}["\`]?.*(\\r\\n|\\r|\\n)?`,
          "gi",
        )
        return prevCode.replace(pattern, "").trim()
      })
    },
    [readOnly],
  )

  const handleSelectElement = useCallback((item: SchemaTable | SchemaRef) => {
    setHighlightRequest({ line: item.line, col: item.column, ts: Date.now() })
  }, [])

  const startResizing = useCallback(() => setIsResizing(true), [])
  const stopResizing = useCallback(() => setIsResizing(false), [])
  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing && sidebarRef.current) {
        const newWidth =
          e.clientX - sidebarRef.current.getBoundingClientRect().left
        if (newWidth < 100) {
          setIsCollapsed(true)
          setIsResizing(false)
        } else {
          if (isCollapsed) setIsCollapsed(false)
          setSidebarWidth(
            Math.min(Math.max(newWidth, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH),
          )
        }
      }
    },
    [isResizing, isCollapsed],
  )

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize)
      window.addEventListener("mouseup", stopResizing)
    }
    return () => {
      window.removeEventListener("mousemove", resize)
      window.removeEventListener("mouseup", stopResizing)
    }
  }, [isResizing, resize, stopResizing])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullScreen) setIsFullScreen(false)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isFullScreen])

  const firstError = effectiveErrors[0]
  const hasErrors = effectiveErrors.length > 0
  const canSave =
    hasContent && !hasErrors && !isSaving && !isGenerating && isDirty

  return (
    <div
      ref={sidebarRef}
      className={`flex flex-row bg-white text-gray-800 font-sans overflow-hidden border border-gray-200 shadow-sm select-none transition-all duration-200 ${
        isFullScreen
          ? "fixed inset-0 z-[9999] h-screen w-screen"
          : "relative h-full w-full"
      }`}
    >
      {/* LEFT SIDEBAR */}
      <div
        style={{ width: isCollapsed ? 0 : sidebarWidth }}
        className={`flex flex-col bg-[#f2f2ed] z-10 flex-shrink-0 relative transition-all duration-75 ease-linear 
          ${isResizing ? "pointer-events-none select-none" : ""}
          ${isCollapsed ? "border-none" : "border-r border-gray-200"} 
        `}
      >
        {!isCollapsed && (
          <>
            <div className="h-12 flex items-center justify-between px-3 border-b border-gray-200 shrink-0 overflow-hidden bg-[#f2f2ed]">
              <div className="flex items-center gap-2 text-md truncate text-gray-700">
                <Database size={20} />
                <span className="hidden sm:inline">SCHEMA</span>
              </div>
              <div className="flex gap-2 items-center">
                {" "}
                {readOnly ? (
                  <>
                    <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded border border-amber-200 uppercase tracking-wide cursor-default">
                      Read Only
                    </span>
                    <div className="h-4 w-px bg-gray-300 mx-1" />
                  </>
                ) : (
                  <>
                    {onGenerate && (
                      <button
                        onClick={() => onGenerate(hasContent)}
                        disabled={isGenerating || isSaving}
                        className="p-1.5 hover:bg-gray-200 rounded text-gray-500 disabled:opacity-30 transition-colors"
                        title={
                          hasContent ? "Regenerate Schema" : "Generate Schema"
                        }
                      >
                        {isGenerating ? (
                          <Loader2
                            size={16}
                            className="animate-spin text-blue-600"
                          />
                        ) : (
                          <ListRestart size={16} />
                        )}
                      </button>
                    )}

                    <button
                      onClick={handleSave}
                      disabled={!canSave}
                      className="hover:bg-gray-200 cursor-pointer text-gray-500 px-3 py-1.5 rounded text-xs font-bold flex gap-2 items-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title={
                        isInvalidEmpty
                          ? "Schema cannot be empty"
                          : hasErrors
                            ? "Fix schema errors before saving"
                            : !isDirty
                              ? "No changes to save"
                              : "Save changes"
                      }
                    >
                      {isSaving ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Save size={16} />
                      )}
                      {isSaving ? "Saving" : ""}
                    </button>

                    <div className="h-4 w-px bg-gray-300 mx-1" />

                    <button
                      onClick={() => setCode(initialSchema)}
                      disabled={!isDirty}
                      className="p-1.5 hover:bg-gray-200 rounded text-gray-500 transition-colors"
                      title="Reset to original"
                    >
                      <RotateCcw size={16} />
                    </button>
                  </>
                )}
                <button
                  onClick={handleCopy}
                  className="p-1.5 hover:bg-gray-200 rounded text-gray-500 transition-colors"
                  title="Copy Code"
                >
                  {isCopied ? (
                    <Check size={16} className="text-green-600" />
                  ) : (
                    <Copy size={16} />
                  )}
                </button>
                {/* Fullscreen Toggle - Hidden in ReadOnly */}
                {!readOnly && (
                  <button
                    onClick={() => setIsFullScreen(!isFullScreen)}
                    className="p-1.5 hover:bg-gray-200 rounded text-gray-500 transition-colors"
                    title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
                  >
                    {isFullScreen ? (
                      <Minimize2 size={16} />
                    ) : (
                      <Maximize2 size={16} />
                    )}
                  </button>
                )}
                <button
                  onClick={() => setIsCollapsed(true)}
                  className="p-1.5 hover:bg-gray-200 rounded text-gray-500 transition-colors"
                  title="Collapse Editor"
                >
                  <PanelLeftClose size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 relative flex flex-col overflow-hidden">
              <MonacoWrapper
                value={code}
                onChange={setCode}
                readOnly={readOnly}
                schemaTables={schemaData.tables}
                validationErrors={effectiveErrors}
                onCursorChange={(line, col) => setCursorPos({ line, col })}
                highlightRequest={highlightRequest}
              />
              {/* FOOTER */}
              <div className="bg-[#f2f2ed] border-t border-gray-200 flex justify-between items-center px-3 py-1 text-xs shrink-0 h-8 gap-4">
                <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
                  {firstError ? (
                    <div
                      className="flex items-center gap-2 text-red-600 truncate"
                      title={firstError.message}
                    >
                      <AlertCircle size={16} className="shrink-0" />
                      <span className="font-semibold truncate">
                        {firstError.message === "Schema cannot be empty"
                          ? "Schema can't be empty"
                          : `Error on Line ${firstError.startLineNumber}: ${firstError.message}`}
                        {effectiveErrors.length > 1 &&
                          ` (+${effectiveErrors.length - 1} more)`}
                      </span>
                    </div>
                  ) : (
                    isDirty && (
                      <div className="flex items-center gap-2 text-amber-600 font-semibold animate-in fade-in">
                        <AlertTriangle size={16} /> Unsaved Changes
                      </div>
                    )
                  )}
                </div>

                {/* Cursor Info only shown when there is NO error */}

                {!firstError && (
                  <div className="text-gray-500 font-mono shrink-0 pl-3">
                    Ln {cursorPos.line}, Col {cursorPos.col}
                  </div>
                )}
              </div>{" "}
            </div>
          </>
        )}
      </div>

      {/* DRAG HANDLE */}
      {!isCollapsed && (
        <div
          className="w-1 bg-gray-200 hover:bg-gray-400 cursor-col-resize z-20 flex items-center justify-center group transition-colors delay-75 hover:delay-0 active:bg-blue-600 border-l border-gray-300"
          onMouseDown={startResizing}
        >
          <div className="h-8 w-1 bg-gray-300 rounded-full group-hover:bg-white transition-colors" />
        </div>
      )}

      {/* VISUALIZER */}
      <div className="flex-1 h-full min-w-0 relative bg-gray-50">
        {isCollapsed && (
          <div className="absolute top-4 left-4 z-50 flex gap-2">
            <button
              onClick={() => setIsCollapsed(false)}
              className="bg-white border border-gray-200 text-gray-600 p-2 rounded-lg shadow-md hover:bg-gray-50 hover:text-gray-900 transition-all hover:scale-105 active:scale-95"
              title="Expand Editor"
            >
              <PanelLeftOpen size={16} />
            </button>
            {!readOnly && (
              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="bg-white border border-gray-200 text-gray-600 p-2 rounded-lg shadow-md hover:bg-gray-50 hover:text-gray-900 transition-all hover:scale-105 active:scale-95"
                title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullScreen ? (
                  <Minimize2 size={16} />
                ) : (
                  <Maximize2 size={16} />
                )}{" "}
              </button>
            )}
          </div>
        )}

        <Canvas
          data={schemaData}
          onAddRef={(ref) => setCode((prev) => prev + ref)}
          onRemoveRef={handleRemoveRef}
          onSelectElement={handleSelectElement}
          readOnly={readOnly}
          defaultZoom={defaultZoom}
        />
      </div>

      {isResizing && (
        <div className="fixed inset-0 z-[9999] cursor-col-resize" />
      )}
    </div>
  )
}
