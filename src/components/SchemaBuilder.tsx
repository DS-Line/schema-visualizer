import type { Connection } from "@xyflow/react"
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Copy,
  Database,
  LockIcon,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Save,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import DBMLEditor from "@/components/Editor/DBMLEditor"
import DBMLVisualizer from "@/components/Visualizer/DBMLVisualizer"
import { generateDBMLFromRefs } from "@/lib/generator"
import { parseSchema } from "@/lib/parser"
import type { SchemaRef } from "@/lib/types"
import { validateRelationship } from "@/lib/validation"

interface SchemaBuilderProps {
  initialSchema: string
  initialSelectedColumns?: string[]
  onSave: (data: {
    dbml: string
    refs: SchemaRef[]
    selectedColumns: string[]
  }) => Promise<void>
  defaultCollapsed?: boolean
}

const MIN_SIDEBAR_WIDTH = 300
const MAX_SIDEBAR_WIDTH = 800
const DEFAULT_SIDEBAR_WIDTH = 450

export const SchemaBuilder = ({
  initialSchema,
  initialSelectedColumns = [],
  onSave,
  defaultCollapsed = false,
}: SchemaBuilderProps) => {
  const [isSaving, setIsSaving] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  const [isResizing, setIsResizing] = useState(false)
  const [validationMessage, setValidationMessage] = useState<{
    type: "error" | "warning"
    message: string
  } | null>(null)

  // Track selected text columns (up to 20)
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(initialSelectedColumns),
  )

  // Store initial selections for dirty checking
  const initialSelectionsRef = useRef<Set<string>>(
    new Set(initialSelectedColumns),
  )

  const sidebarRef = useRef<HTMLDivElement>(null)

  // Parse schema only once from initialSchema (DBML editor is readonly)
  const baseSchemaData = useMemo(
    () => parseSchema(initialSchema),
    [initialSchema],
  )

  // Track refs separately for add/remove operations
  const [refs, setRefs] = useState<SchemaRef[]>([])

  // Initialize refs and selections when schema changes
  useEffect(() => {
    setRefs(baseSchemaData.refs)
    initialSelectionsRef.current = new Set(initialSelectedColumns)
    setSelectedColumns(new Set(initialSelectedColumns))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseSchemaData.refs, initialSchema])

  // Combined schema data with live refs
  const schemaData = useMemo(
    () => ({
      ...baseSchemaData,
      refs,
    }),
    [baseSchemaData, refs],
  )

  // Track if refs or selected columns have changed
  const isDirty = useMemo(() => {
    // Check refs changes
    if (refs.length !== baseSchemaData.refs.length) return true

    const refsChanged = !refs.every((ref) =>
      baseSchemaData.refs.some(
        (baseRef) =>
          baseRef.fromTable === ref.fromTable &&
          baseRef.fromCol === ref.fromCol &&
          baseRef.toTable === ref.toTable &&
          baseRef.toCol === ref.toCol,
      ),
    )

    // Check selected columns changes
    const currentSelections = Array.from(selectedColumns).sort()
    const initialSelections = Array.from(initialSelectionsRef.current).sort()
    const columnsChanged =
      currentSelections.length !== initialSelections.length ||
      !currentSelections.every((col, i) => col === initialSelections[i])

    return refsChanged || columnsChanged
  }, [refs, baseSchemaData.refs, selectedColumns])

  // Column checkbox toggle handler
  const handleColumnToggle = useCallback(
    (tableName: string, columnName: string) => {
      const key = `${tableName}.${columnName}`

      setSelectedColumns((prev) => {
        const next = new Set(prev)

        if (next.has(key)) {
          next.delete(key)
        } else {
          // Check 20 column limit
          if (next.size >= 20) {
            setValidationMessage({
              type: "warning",
              message: "Maximum 20 columns can be selected",
            })
            setTimeout(() => setValidationMessage(null), 3000)
            return prev
          }
          next.add(key)
        }

        return next
      })
    },
    [],
  )

  // Save handler
  const handleSave = async () => {
    setIsSaving(true)
    try {
      const generatedDBML = generateDBMLFromRefs(initialSchema, refs)

      await onSave({
        dbml: generatedDBML,
        refs: refs,
        selectedColumns: Array.from(selectedColumns),
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Copy to clipboard handler
  const handleCopy = async () => {
    try {
      const generatedDBML = generateDBMLFromRefs(initialSchema, refs)
      await navigator.clipboard.writeText(generatedDBML)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy", err)
    }
  }

  // Delete relationship handler
  const handleEdgeDelete = useCallback((refId: string) => {
    setRefs((prevRefs) => prevRefs.filter((r) => r.id !== refId))
  }, [])

  // Create relationship handler with validation
  const handleEdgeCreate = useCallback(
    (connection: Connection) => {
      if (
        !connection.source ||
        !connection.target ||
        !connection.sourceHandle ||
        !connection.targetHandle
      ) {
        return
      }

      // Validate the relationship
      const validation = validateRelationship(
        baseSchemaData.tables,
        connection.source,
        connection.sourceHandle,
        connection.target,
        connection.targetHandle,
      )

      if (!validation.valid) {
        setValidationMessage({
          type: "error",
          message: validation.error || "Invalid relationship",
        })
        setTimeout(() => setValidationMessage(null), 5000)
        return
      }

      // Check for duplicates
      const exists = refs.some(
        (ref) =>
          ref.fromTable === connection.source &&
          ref.fromCol === connection.sourceHandle &&
          ref.toTable === connection.target &&
          ref.toCol === connection.targetHandle,
      )

      if (exists) {
        setValidationMessage({
          type: "warning",
          message: "This relationship already exists",
        })
        setTimeout(() => setValidationMessage(null), 3000)
        return
      }

      // Show warning if present
      if (validation.warning) {
        setValidationMessage({
          type: "warning",
          message: validation.warning,
        })
        setTimeout(() => setValidationMessage(null), 5000)
      }

      // Create new relationship
      const newRef: SchemaRef = {
        id: `rel-${Date.now()}`,
        fromTable: connection.source,
        fromCol: connection.sourceHandle,
        toTable: connection.target,
        toCol: connection.targetHandle,
        relationType: ">",
      }

      setRefs((prevRefs) => [...prevRefs, newRef])
    },
    [refs, baseSchemaData.tables],
  )

  // Sidebar resizing handlers
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

  // Resize event listeners
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

  const canSave = isDirty && !isSaving

  return (
    <div
      ref={sidebarRef}
      className="flex flex-row bg-white text-gray-800 font-sans overflow-hidden border border-gray-200 shadow-sm select-none relative h-full w-full"
    >
      {/* LEFT SIDEBAR - DBML Editor */}
      <div
        style={{ width: isCollapsed ? 0 : sidebarWidth }}
        className={`flex flex-col bg-[#f2f2ed] z-10 shrink-0 relative transition-all duration-75 ease-linear
          ${isResizing ? "pointer-events-none select-none" : ""}
          ${isCollapsed ? "border-none" : "border-r border-gray-200"}
        `}
      >
        {!isCollapsed && (
          <>
            {/* Sidebar Header */}
            <div className="h-12 flex items-center justify-between px-3 border-b border-gray-200 shrink-0 overflow-hidden bg-[#f2f2ed]">
              <div className="flex items-center gap-2 text-md truncate text-gray-700">
                <Database size={20} />
                <span className="hidden sm:inline font-medium">SCHEMA</span>
              </div>

              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave}
                  className="hover:bg-gray-200 cursor-pointer text-gray-500 px-3 py-1.5 rounded text-xs font-bold flex gap-2 items-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title={!isDirty ? "No changes to save" : "Save changes"}
                >
                  <Save size={16} />
                  {isSaving && "Saving..."}
                </button>

                <div className="h-4 w-px bg-gray-300 mx-1" />

                <button
                  type="button"
                  onClick={() => {
                    setRefs(baseSchemaData.refs)
                    setSelectedColumns(new Set(initialSelectionsRef.current))
                  }}
                  disabled={!isDirty}
                  className="p-1.5 hover:bg-gray-200 rounded text-gray-500 transition-colors disabled:opacity-30"
                  title="Reset to original"
                >
                  <RotateCcw size={16} />
                </button>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1.5 hover:bg-gray-200 rounded text-gray-500 transition-colors"
                  title="Copy DBML"
                >
                  {isCopied ? (
                    <Check size={16} className="text-green-600" />
                  ) : (
                    <Copy size={16} />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsCollapsed(true)}
                  className="p-1.5 hover:bg-gray-200 rounded text-gray-500 transition-colors"
                  title="Collapse Editor"
                >
                  <PanelLeftClose size={16} />
                </button>
              </div>
            </div>

            {/* Editor */}
            <div className="flex-1 relative flex flex-col overflow-hidden">
              <DBMLEditor value={generateDBMLFromRefs(initialSchema, refs)} />
            </div>

            <div className="flex justify-between py-2 px-4 border-t border-[#BCBDBE] font-mono text-xs">
              <div className="inline-flex items-center gap-2">
                <LockIcon className="size-3" />
                Read-only
              </div>
              <div>Columns selected: {selectedColumns.size} of 20</div>
            </div>
          </>
        )}
      </div>

      {/* DRAG HANDLE */}
      {!isCollapsed && (
        // biome-ignore lint/a11y/noStaticElementInteractions: ignore
        <div
          className="w-1 bg-gray-200 hover:bg-gray-400 cursor-col-resize z-20 flex items-center justify-center group transition-colors delay-75 hover:delay-0 active:bg-blue-600 border-l border-gray-300"
          onMouseDown={startResizing}
        >
          <div className="h-8 w-1 bg-gray-300 rounded-full group-hover:bg-white transition-colors" />
        </div>
      )}

      {/* RIGHT SIDE - Visualizer */}
      <div className="flex-1 h-full min-w-0 relative">
        {/* Expand button when collapsed */}
        {isCollapsed && (
          <div className="absolute top-4 left-4 z-50">
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="bg-white border border-gray-200 text-gray-600 p-2 rounded-lg shadow-md hover:bg-gray-50 hover:text-gray-900 transition-all hover:scale-105 active:scale-95"
              title="Expand Editor"
            >
              <PanelLeftOpen size={16} />
            </button>
          </div>
        )}

        {/* Validation Toast */}
        {validationMessage && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-top duration-200">
            <div
              className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border ${
                validationMessage.type === "error"
                  ? "bg-red-50 border-red-200 text-red-800"
                  : "bg-amber-50 border-amber-200 text-amber-800"
              }`}
            >
              {validationMessage.type === "error" ? (
                <AlertCircle size={18} className="shrink-0" />
              ) : (
                <AlertTriangle size={18} className="shrink-0" />
              )}
              <span className="text-sm font-medium">
                {validationMessage.message}
              </span>
              <button
                type="button"
                onClick={() => setValidationMessage(null)}
                className="ml-2 hover:opacity-70 transition-opacity"
                title="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Visualizer */}
        <DBMLVisualizer
          data={schemaData}
          onEdgeDelete={handleEdgeDelete}
          onEdgeCreate={handleEdgeCreate}
          selectedColumns={selectedColumns}
          onColumnToggle={handleColumnToggle}
        />
      </div>

      {/* Resize overlay */}
      {isResizing && <div className="fixed inset-0 z-9999 cursor-col-resize" />}
    </div>
  )
}
