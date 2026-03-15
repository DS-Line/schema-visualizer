import { Handle, Position, useUpdateNodeInternals } from "@xyflow/react"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  KeyIcon,
  PanelsTopLeftIcon,
} from "lucide-react"
import { memo, useCallback, useEffect, useMemo } from "react"
import { isTextColumn } from "../../lib/column-utils"
import type { SchemaTable } from "../../lib/types"
import { cn } from "../../lib/utils"
import { Checkbox } from "../ui/checkbox"

interface TableNodeData {
  table: SchemaTable
  cachedColumns?: Set<string>
  onColumnToggle?: (tableName: string, columnName: string) => void
  relatedCols: Set<string>
  isCollapsed?: boolean
  onToggleCollapse?: (tableName: string) => void
  selectedRefCols?: Set<string>
}

interface Props {
  data: TableNodeData
}

export const COLLAPSE_THRESHOLD = 8
const ROW_HEIGHT = 25

export const TableNode = memo<Props>(({ data }) => {
  const {
    table,
    cachedColumns,
    onColumnToggle,
    relatedCols,
    isCollapsed = false,
    onToggleCollapse,
    selectedRefCols,
  } = data

  const collapsible = table.columns.length > COLLAPSE_THRESHOLD

  // Compute target vertical position for each column.
  // DOM order never changes — only `top` values animate via CSS transition.
  const columnPositions = useMemo(() => {
    const sorted = [...table.columns].sort((a, b) => {
      const ai = table.columns.indexOf(a)
      const bi = table.columns.indexOf(b)
      if (a.isPk !== b.isPk) return a.isPk ? -1 : 1
      if (isCollapsed) {
        const aRel = relatedCols.has(a.name)
        const bRel = relatedCols.has(b.name)
        if (aRel !== bRel) return aRel ? -1 : 1
      }
      return ai - bi
    })
    return new Map(sorted.map((col, i) => [col.name, i]))
  }, [table.columns, isCollapsed, relatedCols])

  const visibleCount =
    collapsible && isCollapsed ? COLLAPSE_THRESHOLD : table.columns.length

  const updateNodeInternals = useUpdateNodeInternals()

  // Force React Flow to re-measure handle positions when sort order changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — columnPositions encapsulates all sort deps
  useEffect(() => {
    updateNodeInternals(table.name)
  }, [columnPositions, table.name, updateNodeInternals])

  // Re-measure after the height animation finishes — more reliable than a fixed timeout.
  const onRowsTransitionEnd = useCallback(() => {
    updateNodeInternals(table.name)
  }, [table.name, updateNodeInternals])

  return (
    <div className="w-72 bg-teal-7 border border-teal-7 border-t-4 rounded overflow-hidden text-xs leading-4 font-mono">
      <div className="bg-teal-1 flex items-center gap-2 px-4 pt-3 pb-2 border-teal-7 border-b rounded-t">
        <PanelsTopLeftIcon className="size-3 shrink-0" />
        <span className="truncate">{table.name}</span>
      </div>

      {/* Rows container — fixed height clips hidden rows; rows animate via `top` */}
      <div
        className="relative overflow-hidden"
        style={{
          height: `${visibleCount * ROW_HEIGHT}px`,
          transition: "height 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        onTransitionEnd={onRowsTransitionEnd}
      >
        {table.columns.map((col) => {
          const columnKey = `${table.name}.${col.name}`
          const isSelected = cachedColumns?.has(columnKey) ?? false
          const sortedIndex = columnPositions.get(col.name) ?? 0
          const isVisible = sortedIndex < visibleCount

          return (
            <div
              key={col.name}
              className="absolute w-full flex items-center group border-b border-black-1 divide-x divide-black-1"
              style={{
                top: `${sortedIndex * ROW_HEIGHT}px`,
                height: `${ROW_HEIGHT}px`,
                transition: "top 0.45s cubic-bezier(0.4, 0, 0.2, 1)",
                background: "white",
              }}
            >
              {/* Only render handles for visible rows — hidden handles confuse React Flow's connection snapping */}
              {isVisible && (
                <Handle
                  id={col.name}
                  type="target"
                  position={Position.Left}
                  className="absolute! inset-0! w-full! h-full! rounded-none! border-none! bg-transparent! transform-none!"
                  style={{ left: 0, top: 0 }}
                />
              )}
              {isVisible && (
                <Handle
                  id={col.name}
                  type="source"
                  position={Position.Right}
                  className="absolute! inset-0! w-full! h-full! rounded-none! border-none! bg-transparent! transform-none!"
                  style={{ left: 0, top: 0 }}
                />
              )}

              <div className="flex-1 flex justify-between px-4 py-1 gap-2 min-w-0">
                <div
                  className={cn(
                    "pointer-events-none relative z-10 group-hover:text-accent truncate",
                    col.isPk && "font-bold",
                    selectedRefCols?.has(col.name) && "text-accent",
                  )}
                >
                  {col.name}
                </div>
                <div className="inline-flex pointer-events-none relative z-10 shrink-0 max-w-[45%] pl-2">
                  {col.isPk && <KeyIcon className="size-3 mr-1 shrink-0" />}
                  <span className="text-black-5 truncate">{col.type}</span>
                </div>
              </div>
              <div className="size-6 shrink-0 flex justify-center items-center pointer-events-none relative z-10">
                {isTextColumn(col.type) && onColumnToggle && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onColumnToggle(table.name, col.name)}
                    className="pointer-events-auto cursor-pointer"
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {collapsible && (
        <button
          type="button"
          onClick={() => onToggleCollapse?.(table.name)}
          className="w-full flex items-center justify-center gap-1 py-1.5 text-white bg-teal-7 border-t border-teal-7 cursor-pointer pointer-events-auto"
        >
          {isCollapsed ? (
            <>
              show {table.columns.length - COLLAPSE_THRESHOLD} more{" "}
              <ChevronDownIcon className="size-3" />
            </>
          ) : (
            <>
              show less <ChevronUpIcon className="size-3" />
            </>
          )}
        </button>
      )}
    </div>
  )
})

TableNode.displayName = "TableNode"
