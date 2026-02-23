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
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { generateDBMLFromRefs } from "../lib/generator"
import type { SchemaBuilderValue, SchemaData, SchemaRef } from "../lib/types"
import { validateRelationship } from "../lib/validation"

const DBMLEditor = lazy(() => import("./Editor/DBMLEditor"))
const DBMLVisualizer = lazy(() => import("./Visualizer/DBMLVisualizer"))

interface SchemaBuilderChangeData extends SchemaBuilderValue {
  refs: SchemaRef[]
  isDirty: boolean
}

interface SchemaBuilderProps {
  /** Controlled mode — parent owns state. Sync whenever this changes. */
  value?: SchemaBuilderValue
  /** Uncontrolled mode — component owns state, seeded once on mount. */
  defaultValue?: SchemaBuilderValue
  /** Called on every change to refs or selectedColumns. */
  onChange?: (data: SchemaBuilderChangeData) => void
  /** Called when the user explicitly hits Save. */
  onSave?: (data: SchemaBuilderChangeData) => Promise<void>
  defaultCollapsed?: boolean
  /**
   * When true, the visualizer is read-only: no edges can be created or deleted,
   * and column checkboxes are hidden. The DBML editor is always read-only
   * regardless of this flag.
   */
  readonly?: boolean
}

const MIN_SIDEBAR_WIDTH = 300
const MAX_SIDEBAR_WIDTH = 800
const DEFAULT_SIDEBAR_WIDTH = 450

const EMPTY_VALUE: SchemaBuilderValue = { schema: "", selectedColumns: [] }

export const SchemaBuilder = ({
  value,
  defaultValue,
  onChange,
  onSave,
  defaultCollapsed = false,
  readonly = false,
}: SchemaBuilderProps) => {
  const isControlled = value !== undefined

  // ─── Internal schema source ────────────────────────────────────────────────
  const [internalValue, setInternalValue] = useState<SchemaBuilderValue>(
    () => defaultValue ?? EMPTY_VALUE,
  )

  const activeValue = isControlled ? value! : internalValue

  // ─── UI state ──────────────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  const [isResizing, setIsResizing] = useState(false)
  const [validationMessage, setValidationMessage] = useState<{
    type: "error" | "warning"
    message: string
  } | null>(null)

  const sidebarRef = useRef<HTMLDivElement>(null)

  // ─── Parsed base schema ────────────────────────────────────────────────────
  const [baseSchemaData, setBaseSchemaData] = useState<SchemaData | null>(null)

  useEffect(() => {
    if (!activeValue.schema) return

    let cancelled = false

    const load = async () => {
      try {
        const { parseSchema } = await import("../lib/parser")
        if (cancelled) return
        const parsed = parseSchema(activeValue.schema)
        setBaseSchemaData(parsed)
        setRefs(parsed.refs)
      } catch (err) {
        console.error("[SchemaBuilder] Failed to parse schema:", err)
        if (cancelled) return
        setBaseSchemaData({
          tables: [],
          refs: [],
          fetchedCols: new Set(),
          errors: [],
        })
        setRefs([])
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [activeValue.schema])

  // ─── Live refs (add / remove on canvas) ───────────────────────────────────
  const [refs, setRefs] = useState<SchemaRef[]>([])

  // ─── Selected columns ─────────────────────────────────────────────────────
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    () => new Set(activeValue.selectedColumns),
  )

  useEffect(() => {
    if (!isControlled) return
    setSelectedColumns(new Set(value?.selectedColumns))
  }, [isControlled, value])

  // ─── Dirty tracking ───────────────────────────────────────────────────────
  const isDirty = useMemo(() => {
    if (!baseSchemaData) return false

    if (refs.length !== baseSchemaData.refs.length) return true

    const refsChanged = !refs.every((ref) =>
      baseSchemaData.refs.some(
        (base) =>
          base.fromTable === ref.fromTable &&
          base.fromCol === ref.fromCol &&
          base.toTable === ref.toTable &&
          base.toCol === ref.toCol,
      ),
    )

    const currentCols = Array.from(selectedColumns).sort()
    const initialCols = [...activeValue.selectedColumns].sort()
    const colsChanged =
      currentCols.length !== initialCols.length ||
      !currentCols.every((c, i) => c === initialCols[i])

    return refsChanged || colsChanged
  }, [refs, baseSchemaData, selectedColumns, activeValue.selectedColumns])

  // ─── Emit onChange whenever live state changes ─────────────────────────────
  useEffect(() => {
    if (!onChange || !baseSchemaData) return

    onChange({
      schema: generateDBMLFromRefs(baseSchemaData?.tables ?? [], refs),
      selectedColumns: Array.from(selectedColumns),
      refs,
      isDirty,
    })
  }, [refs, selectedColumns, isDirty, onChange, baseSchemaData])

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const buildChangeData = useCallback(
    (
      overrideRefs?: SchemaRef[],
      overrideCols?: Set<string>,
    ): SchemaBuilderChangeData => ({
      schema: generateDBMLFromRefs(
        baseSchemaData?.tables ?? [],
        overrideRefs ?? refs,
      ),
      selectedColumns: Array.from(overrideCols ?? selectedColumns),
      refs: overrideRefs ?? refs,
      isDirty,
    }),
    [baseSchemaData, refs, selectedColumns, isDirty],
  )

  const handleColumnToggle = useCallback(
    (tableName: string, columnName: string) => {
      if (readonly) return

      const key = `${tableName}.${columnName}`

      setSelectedColumns((prev) => {
        const next = new Set(prev)

        if (next.has(key)) {
          next.delete(key)
        } else {
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

        if (!isControlled) {
          setInternalValue((v) => ({
            ...v,
            selectedColumns: Array.from(next),
          }))
        }

        return next
      })
    },
    [isControlled, readonly],
  )

  const handleSave = async () => {
    if (!onSave) return
    setIsSaving(true)
    try {
      await onSave(buildChangeData())
    } finally {
      setIsSaving(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        generateDBMLFromRefs(baseSchemaData?.tables ?? [], refs),
      )
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy", err)
    }
  }

  const handleReset = useCallback(() => {
    if (readonly) return
    if (baseSchemaData) setRefs(baseSchemaData.refs)
    const resetCols = new Set(activeValue.selectedColumns)
    setSelectedColumns(resetCols)
    if (!isControlled) {
      setInternalValue((v) => ({
        ...v,
        selectedColumns: activeValue.selectedColumns,
      }))
    }
  }, [baseSchemaData, activeValue.selectedColumns, isControlled, readonly])

  const handleEdgeDelete = useCallback(
    (refId: string) => {
      if (readonly) return
      setRefs((prev) => prev.filter((r) => r.id !== refId))
    },
    [readonly],
  )

  const handleEdgeCreate = useCallback(
    (connection: Connection) => {
      if (readonly) return

      if (
        !connection.source ||
        !connection.target ||
        !connection.sourceHandle ||
        !connection.targetHandle
      )
        return

      const validation = validateRelationship(
        baseSchemaData?.tables ?? [],
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

      if (validation.warning) {
        setValidationMessage({ type: "warning", message: validation.warning })
        setTimeout(() => setValidationMessage(null), 5000)
      }

      setRefs((prev) => [
        ...prev,
        {
          id: `rel-${Date.now()}`,
          fromTable: connection.source!,
          fromCol: connection.sourceHandle!,
          toTable: connection.target!,
          toCol: connection.targetHandle!,
          relationType: ">",
        },
      ])
    },
    [refs, baseSchemaData, readonly],
  )

  // ─── Sidebar resize ───────────────────────────────────────────────────────
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

  // ─── Derived schema data passed to the visualizer ─────────────────────────
  const schemaData = useMemo(() => {
    const fallback: SchemaData = {
      tables: [],
      refs: [],
      fetchedCols: new Set(),
      errors: [],
    }
    return { ...(baseSchemaData ?? fallback), refs }
  }, [baseSchemaData, refs])

  const canSave = isDirty && !isSaving && !!onSave && !readonly

  return (
    <div
      ref={sidebarRef}
      className="flex flex-row text-[#1F2227] font-sans overflow-hidden border border-[#BCBDBE] rounded select-none relative h-full w-full"
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
                {onSave && !readonly && (
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
                )}

                {!readonly && (
                  <>
                    <div className="h-4 w-px bg-gray-300 mx-1" />

                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={!isDirty}
                      className="p-1.5 hover:bg-gray-200 rounded text-gray-500 transition-colors disabled:opacity-30"
                      title="Reset to original"
                    >
                      <RotateCcw size={16} />
                    </button>
                  </>
                )}

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
              <Suspense
                fallback={<div className="w-full h-full bg-[#f2f2ed]" />}
              >
                <DBMLEditor
                  value={generateDBMLFromRefs(
                    baseSchemaData?.tables ?? [],
                    refs,
                  )}
                />
              </Suspense>
            </div>

            <div className="flex justify-between py-2 px-4 border-t border-[#BCBDBE] font-mono text-xs">
              <div className="inline-flex items-center gap-2">
                <LockIcon className="size-3" />
                {readonly ? "Read-only" : "Read-only editor"}
              </div>
              {!readonly && (
                <div>Columns selected: {selectedColumns.size} of 20</div>
              )}
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

        <Suspense fallback={<div className="w-full h-full bg-white" />}>
          <DBMLVisualizer
            data={schemaData}
            onEdgeDelete={readonly ? undefined : handleEdgeDelete}
            onEdgeCreate={readonly ? undefined : handleEdgeCreate}
            selectedColumns={selectedColumns}
            onColumnToggle={readonly ? undefined : handleColumnToggle}
            readonly={readonly}
          />
        </Suspense>
      </div>

      {isResizing && <div className="fixed inset-0 z-9999 cursor-col-resize" />}
    </div>
  )
}
