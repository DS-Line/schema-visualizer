import type { Connection } from "@xyflow/react"
import { AlertCircle, Workflow } from "lucide-react"
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { formatDBML } from "../lib/formatter"
import { parseSchema } from "../lib/parser"
import type { SchemaData, SchemaEditorValue, SchemaRef } from "../lib/types"
import { validateRelationship } from "../lib/validation"
import { ColumnInfoPanel } from "./ColumnInfoPanel"
import { Icons } from "./icons"
import { Toast } from "./ui/toast"

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_SIDEBAR_WIDTH = 300
const MAX_SIDEBAR_WIDTH = 800
const DEFAULT_SIDEBAR_WIDTH = 375
const MAX_CACHED_COLUMNS = 20

const EMPTY_VALUE: SchemaEditorValue = { schema: "", cachedColumns: [] }
const EMPTY_SCHEMA: SchemaData = { tables: [], refs: [], errors: [] }

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Keeps a ref to the latest version of a callback so consumers can pass
 * inline arrow functions without causing useEffect dependency loops.
 */
// biome-ignore lint/suspicious/noExplicitAny: required to forward typed callbacks stably
function useStableCallback<T extends ((...args: any[]) => any) | undefined>(
  fn: T,
): T {
  const ref = useRef(fn)
  useEffect(() => {
    ref.current = fn
  })
  // biome-ignore lint/suspicious/noExplicitAny: generic forwarding requires any
  return useCallback((...args: any[]) => ref.current?.(...args), []) as T
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SchemaEditorChangeData extends SchemaEditorValue {
  refs: SchemaRef[]
  isDirty: boolean
}

interface SchemaEditorProps {
  /** Controlled mode — parent owns state. Synced whenever this changes. */
  value?: SchemaEditorValue
  /** Uncontrolled mode — component owns state, seeded once on mount. */
  defaultValue?: SchemaEditorValue
  /** Called on every change to refs or cachedColumns. */
  onChange?: (data: SchemaEditorChangeData) => void
  defaultCollapsed?: boolean
  /**
   * When true, the visualizer is read-only: no edges can be created or deleted,
   * and column checkboxes are hidden.
   */
  readonly?: boolean
}

// ─── Lazy components ──────────────────────────────────────────────────────────

const DBMLViewer = lazy(() => import("./DBMLViewer"))
const SchemaVisualizer = lazy(() => import("./Visualizer/SchemaVisualizer"))

// ─── Component ────────────────────────────────────────────────────────────────

export const SchemaEditor = ({
  value,
  defaultValue,
  onChange: onChangeProp,
  defaultCollapsed = false,
  readonly = false,
}: SchemaEditorProps) => {
  const isControlled = value !== undefined

  const onChange = useStableCallback(onChangeProp)

  // ─── Schema source ─────────────────────────────────────────────────────────
  const [internalValue, setInternalValue] = useState<SchemaEditorValue>(
    () => defaultValue ?? EMPTY_VALUE,
  )
  // biome-ignore lint/style/noNonNullAssertion: isControlled guarantees value is defined
  const activeValue = isControlled ? value! : internalValue

  // ─── Parsed base schema ────────────────────────────────────────────────────
  // Schema is static — parse once on mount.
  const [baseSchemaData] = useState<SchemaData | null>(() =>
    activeValue.schema ? parseSchema(activeValue.schema) : null,
  )

  // ─── Live refs & selected columns ─────────────────────────────────────────
  const [refs, setRefs] = useState<SchemaRef[]>(
    () => baseSchemaData?.refs ?? [],
  )

  const [cachedColumns, setCachedColumns] = useState<Set<string>>(
    () => new Set(activeValue.cachedColumns),
  )
  const initialCachedColumns = useRef(activeValue.cachedColumns)

  useEffect(() => {
    if (!isControlled) return
    setCachedColumns(new Set(value?.cachedColumns))
  }, [isControlled, value])

  // ─── Selected relationship ─────────────────────────────────────────────────
  const [selectedRefId, setSelectedRefId] = useState<string | null>(null)

  const scrollToLine = useMemo(() => {
    if (!selectedRefId) return undefined
    const ref = refs.find((r) => r.id === selectedRefId)
    if (!ref) return undefined
    const dbml = formatDBML(baseSchemaData?.tables ?? [], refs)
    // formatRef always quotes identifiers, so match that exact format
    const q = (s: string) => `"${s}"`
    const target = `Ref: ${q(ref.fromTable)}.${q(ref.fromCol)} ${ref.relationType} ${q(ref.toTable)}.${q(ref.toCol)}`
    const lineIndex = dbml.split("\n").indexOf(target)
    return lineIndex >= 0 ? lineIndex + 1 : undefined
  }, [selectedRefId, refs, baseSchemaData])

  // ─── UI state ──────────────────────────────────────────────────────────────
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  // In readonly mode the DBML panel is collapsed by default.
  const [isCollapsed, setIsCollapsed] = useState(readonly || defaultCollapsed)
  const [isResizing, setIsResizing] = useState(false)

  // Collapse the editor when entering fullscreen; restore on exit.
  const isCollapsedRef = useRef(isCollapsed)
  useEffect(() => {
    isCollapsedRef.current = isCollapsed
  }, [isCollapsed])
  const preFullscreenCollapsed = useRef(false)
  useEffect(() => {
    const onChange = () => {
      if (document.fullscreenElement) {
        preFullscreenCollapsed.current = isCollapsedRef.current
        setIsCollapsed(true)
      } else {
        setIsCollapsed(preFullscreenCollapsed.current)
      }
    }
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])
  // Auto-collapse on small screens (< 768px)
  useEffect(() => {
    const check = () => {
      if (window.innerWidth < 768) setIsCollapsed(true)
    }
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // When the schema fails to parse, ensure the raw DBML panel is visible.
  const hasParseError = (baseSchemaData?.errors?.length ?? 0) > 0
  useEffect(() => {
    if (hasParseError) setIsCollapsed(false)
  }, [hasParseError])

  const [autoArrange, setAutoArrange] = useState(true)
  const [toast, setToast] = useState<{
    type: "error" | "warning"
    message: string
  } | null>(null)

  const sidebarRef = useRef<HTMLDivElement>(null)

  const showToast = useCallback(
    (type: "error" | "warning", message: string, durationMs = 4000) => {
      setToast({ type, message })
      setTimeout(() => setToast(null), durationMs)
    },
    [],
  )

  // ─── Dirty tracking ────────────────────────────────────────────────────────
  const isDirty = useMemo(() => {
    if (!baseSchemaData) return false

    const refsChanged =
      refs.length !== baseSchemaData.refs.length ||
      !refs.every((ref) =>
        baseSchemaData.refs.some(
          (base) =>
            base.fromTable === ref.fromTable &&
            base.fromCol === ref.fromCol &&
            base.toTable === ref.toTable &&
            base.toCol === ref.toCol,
        ),
      )

    const currentCols = Array.from(cachedColumns).sort()
    const initialCols = [...activeValue.cachedColumns].sort()
    const colsChanged =
      currentCols.length !== initialCols.length ||
      !currentCols.every((c, i) => c === initialCols[i])

    return refsChanged || colsChanged
  }, [refs, baseSchemaData, cachedColumns, activeValue.cachedColumns])

  // ─── Emit onChange ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!onChange || !baseSchemaData) return
    onChange({
      schema: formatDBML(baseSchemaData.tables, refs),
      cachedColumns: Array.from(cachedColumns),
      refs,
      isDirty,
    })
  }, [refs, cachedColumns, isDirty, onChange, baseSchemaData])

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleColumnToggle = useCallback(
    (tableName: string, columnName: string) => {
      const key = `${tableName}.${columnName}`
      setCachedColumns((prev) => {
        const next = new Set(prev)
        if (next.has(key)) {
          next.delete(key)
        } else {
          if (next.size >= MAX_CACHED_COLUMNS) {
            showToast(
              "warning",
              `Maximum ${MAX_CACHED_COLUMNS} columns can be selected`,
            )
            return prev
          }
          next.add(key)
        }
        if (!isControlled) {
          setInternalValue((v) => ({ ...v, cachedColumns: Array.from(next) }))
        }
        return next
      })
    },
    [isControlled, showToast],
  )

  const handleEdgeDelete = useCallback(
    (refId: string) => {
      setRefs((prev) => prev.filter((r) => r.id !== refId))
    },
    [],
  )

  const handleEdgeCreate = useCallback(
    (connection: Connection) => {
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
        showToast("error", validation.error ?? "Invalid relationship")
        return
      }

      const exists = refs.some(
        (ref) =>
          (ref.fromTable === connection.source &&
            ref.fromCol === connection.sourceHandle &&
            ref.toTable === connection.target &&
            ref.toCol === connection.targetHandle) ||
          (ref.fromTable === connection.target &&
            ref.fromCol === connection.targetHandle &&
            ref.toTable === connection.source &&
            ref.toCol === connection.sourceHandle),
      )
      if (exists) {
        showToast("warning", "This relationship already exists")
        return
      }

      if (validation.warning) {
        showToast("warning", validation.warning)
      }

      setRefs((prev) => [
        ...prev,
        {
          id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
          fromTable: connection.source as string,
          fromCol: connection.sourceHandle as string,
          toTable: connection.target as string,
          toCol: connection.targetHandle as string,
          relationType: ">",
        },
      ])
    },
    [refs, baseSchemaData, showToast],
  )

  // ─── Sidebar resize ────────────────────────────────────────────────────────
  const stopResizing = useCallback(() => setIsResizing(false), [])

  const resize = useCallback(
    (e: MouseEvent) => {
      if (!sidebarRef.current) return
      const newWidth =
        e.clientX - sidebarRef.current.getBoundingClientRect().left
      if (isCollapsed) setIsCollapsed(false)
      setSidebarWidth(
        Math.min(Math.max(newWidth, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH),
      )
    },
    [isCollapsed],
  )

  useEffect(() => {
    if (!isResizing) return
    window.addEventListener("mousemove", resize)
    window.addEventListener("mouseup", stopResizing)
    return () => {
      window.removeEventListener("mousemove", resize)
      window.removeEventListener("mouseup", stopResizing)
    }
  }, [isResizing, resize, stopResizing])

  // ─── Derived schema data ───────────────────────────────────────────────────
  const schemaData = useMemo(
    () => ({ ...(baseSchemaData ?? EMPTY_SCHEMA), refs }),
    [baseSchemaData, refs],
  )

  return (
    <div
      ref={sidebarRef}
      className="flex flex-row overflow-hidden border border-black-3 rounded select-none relative h-full w-full"
    >
      {/* LEFT SIDEBAR — DBML Viewer */}
      <div
        style={{ width: isCollapsed ? 0 : sidebarWidth }}
        className={`flex flex-col bg-cream-1 z-10 shrink-0 relative transition-all duration-75 ease-linear
          ${isResizing ? "pointer-events-none select-none" : ""}
          ${isCollapsed ? "border-none" : "border-r border-black-3"}
        `}
      >
        {!isCollapsed && (
          <>
            <div className="h-12 flex items-center justify-between px-4 py-3 border-b border-black-3 shrink-0 overflow-hidden">
              <div className="flex items-center gap-2 truncate text-black-10">
                <Icons.checkFilled className="size-4 text-primary" />
                <span className="hidden sm:inline text-sm mt-1 font-normal">Schema</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                className="flex"
                title="Collapse Editor"
              >
                <Icons.collapse className="size-4" />
              </button>
            </div>

            <div className="flex-1 relative flex flex-col overflow-hidden opacity-70 font-mono">
              <Suspense fallback={<div className="w-full h-full" />}>
                <DBMLViewer
                  value={formatDBML(baseSchemaData?.tables ?? [], refs)}
                  scrollToLine={scrollToLine}
                />
              </Suspense>
            </div>

            <div className="flex justify-between py-2 px-4 border-t border-black-3 text-xs">
              <div className="inline-flex items-center gap-2">
                <Icons.lock className="size-3" />
                Read-only
              </div>
            </div>
          </>
        )}
      </div>

      {/* DRAG HANDLE */}
      {!isCollapsed && (
        // biome-ignore lint/a11y/noStaticElementInteractions: drag handle
        <div
          className="-translate-x-1/2 cursor-col-resize z-20 flex items-center justify-center group transition-colors delay-75 hover:delay-0 opacity-100"
          onMouseDown={() => setIsResizing(true)}
        >
          <div className="absolute h-12 w-2 bg-black-1 rounded-full group-hover:bg-black-3 transition-colors" />
        </div>
      )}

      {/* RIGHT SIDE — Visualizer */}
      <div className="flex-1 h-full min-w-0 relative">
        {isCollapsed && (
          <div className="absolute top-4 left-4 z-50">
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="text-black-5  hover:text-black-10 transition-colors"
              title="Expand Editor"
            >
              <Icons.expand className="size-5" />
            </button>
          </div>
        )}

        {toast && (
          <Toast
            message={toast.message}
            variant={toast.type === "error" ? "destructive" : "warning"}
          />
        )}

        {hasParseError && (
          <div className="absolute top-0 left-0 right-0 z-30 flex items-start gap-2 px-4 py-2.5 bg-red-50 border-b border-red-200">
            <AlertCircle className="size-3.5 text-red-500 shrink-0 mt-px" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-red-700">
                Failed to parse schema
              </p>
              <p className="text-xs text-red-500 truncate">
                {baseSchemaData?.errors[0].message}
              </p>
            </div>
          </div>
        )}

        <Suspense fallback={<div className="w-full h-full bg-white" />}>
          <SchemaVisualizer
            data={schemaData}
            onEdgeDelete={readonly ? undefined : handleEdgeDelete}
            onEdgeCreate={readonly ? undefined : handleEdgeCreate}
            onEdgeSelect={setSelectedRefId}
            cachedColumns={cachedColumns}
            onColumnToggle={readonly ? undefined : handleColumnToggle}
            readonly={readonly}
            fullscreenRef={sidebarRef}
            sidebarCollapsed={isCollapsed}
            autoArrange={autoArrange}
          />
        </Suspense>

        {/* Top-right controls — hidden in readonly */}
        {!readonly && (
          <div className="absolute top-4 right-4 z-40 flex items-start gap-3 pointer-events-auto">
            <button
              type="button"
              title={autoArrange ? "Auto-arrange on" : "Auto-arrange off"}
              onClick={() => setAutoArrange((v) => !v)}
              className={`transition-colors ${autoArrange ? "text-black-10" : "text-black-5 hover:text-black-10"}`}
            >
              <Workflow size={20} />
            </button>

            <ColumnInfoPanel
              cachedColumns={cachedColumns}
              initialCachedColumns={initialCachedColumns.current}
            />
          </div>
        )}
      </div>

      {isResizing && <div className="fixed inset-0 z-9999 cursor-col-resize" />}
    </div>
  )
}
