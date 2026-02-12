import { Handle, Position } from "@xyflow/react"
import { KeyIcon, PanelsTopLeftIcon } from "lucide-react"
import { memo } from "react"
import type { SchemaTable } from "../../lib/types"
import { Checkbox } from "../ui/checkbox"

interface Props {
  data: {
    table: SchemaTable
    selectedColumns?: Set<string>
    onColumnToggle?: (tableName: string, columnName: string) => void
  }
}

// Check if column is a text type
const isTextColumn = (type: string): boolean => {
  const normalizedType = type
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .trim()
  const textTypes = ["varchar", "char", "text", "string", "nvarchar", "nchar"]
  return textTypes.includes(normalizedType)
}

export const TableNode = memo<Props>(({ data }) => {
  const { table, selectedColumns, onColumnToggle } = data

  return (
    <div className="w-72 bg-[#35383D] rounded-lg text-white overflow-clip text-sm leading-4 font-mono">
      <div className="bg-[#1F2227] flex items-center gap-1 px-4 py-2">
        <PanelsTopLeftIcon className="size-3" />
        {table.name}
      </div>
      <div className="flex flex-col">
        {table.columns.map((col) => {
          const isText = isTextColumn(col.type)
          const columnKey = `${table.name}.${col.name}`
          const isSelected = selectedColumns?.has(columnKey) || false

          return (
            <div
              key={col.name}
              className="grid grid-cols-[12px_12px_1fr_1fr] items-center px-4 py-2 gap-2 group relative hover:bg-[#2A2D32]"
            >
              {/* Left handle - Target - covers entire row */}
              <Handle
                id={col.name}
                type="target"
                position={Position.Left}
                className="absolute! inset-0! w-full! h-full! rounded-none! border-none! bg-transparent! transform-none!"
                style={{ left: 0, top: 0 }}
              />
              {/* Right handle - Source - covers entire row */}
              <Handle
                id={col.name}
                type="source"
                position={Position.Right}
                className="absolute! inset-0! w-full! h-full! rounded-none! border-none! bg-transparent! transform-none!"
                style={{ left: 0, top: 0 }}
              />

              <div className="flex justify-center pointer-events-none relative z-10">
                {isText && onColumnToggle && (
                  // <input
                  //   type="checkbox"
                  //   checked={isSelected}
                  //   onChange={() => onColumnToggle(table.name, col.name)}
                  //   className="pointer-events-auto cursor-pointer accent-[#136643] ring-red-400"
                  //   title="Select text column"
                  // />
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onColumnToggle(table.name, col.name)}
                    className="pointer-events-auto cursor-pointer"
                  />
                )}
              </div>
              <div className="flex justify-center pointer-events-none relative z-10">
                {col.isPk && <KeyIcon className="size-3 text-[#008080]" />}
              </div>
              <div className="pointer-events-none relative z-10">
                {col.name}
              </div>
              <div className="text-muted-foreground pointer-events-none relative z-10">
                {col.type}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})

TableNode.displayName = "TableNode"
