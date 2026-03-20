import { useEffect, useRef, useState } from "react"
import { cn } from "../lib/utils"
import Icon from "./ico-icons/icon"

interface Props {
  cachedColumns: Set<string>
  initialCachedColumns: string[]
}

const AUTO_CLOSE_MS = 10000

export function ColumnInfoPanel({
  cachedColumns,
  initialCachedColumns,
}: Props) {
  const isEmpty = initialCachedColumns.length === 0 && cachedColumns.size === 0
  const [open, setOpen] = useState(isEmpty)
  const [progress, setProgress] = useState(100)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally mount-only — timer starts once
  useEffect(() => {
    if (!isEmpty) return
    const startTime = Date.now()

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 100 - (elapsed / AUTO_CLOSE_MS) * 100)
      setProgress(remaining)

      if (elapsed >= AUTO_CLOSE_MS) {
        setOpen(false)
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }, 50)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const handleClick = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
      setProgress(0)
    }
    setOpen((prev) => !prev)
  }

  return (
    <div className="relative">
      <button
        type="button"
        title="Info"
        onClick={handleClick}
        className={cn(
          "transition-colors",
          open ? "text-teal-7" : "text-black-5 hover:text-black-10 ",
        )}
      >
        <Icon size={20} icon="Info" />
      </button>

      {open && (
        <div className="absolute top-full right-0 pt-1.5 z-50">
          <div className="w-72 rounded-lg bg-white-1 border border-black-2 shadow-md text-xs overflow-hidden">
            <div className="px-4 py-3">
              <p className="font-medium text-black-10 mb-1">Cached columns</p>
              <p className="text-black-7 leading-snug text-xs">
                Check columns with regular business terms to cache them. Cached
                columns help generate better &amp; faster answers.
              </p>
              {(() => {
                const initial = new Set(initialCachedColumns)
                // stable order: initial columns first (in original order), then new additions
                const added = Array.from(cachedColumns).filter(
                  (c) => !initial.has(c),
                )
                const allRows = [
                  ...initialCachedColumns.map((col) => ({
                    col,
                    status: cachedColumns.has(col)
                      ? "unchanged"
                      : ("removed" as const),
                  })),
                  ...added.map((col) => ({ col, status: "added" as const })),
                ]
                const hasDiff =
                  added.length > 0 ||
                  allRows.some((r) => r.status === "removed")
                if (cachedColumns.size === 0 && !hasDiff) return null
                return (
                  <div className="mt-3">
                    <p className="font-medium text-black-10 mb-1">
                      Selected columns ({cachedColumns.size})
                    </p>
                    <ul className="space-y-0.5 max-h-40 overflow-y-auto font-mono text-xs">
                      {allRows.map(({ col, status }) => (
                        <li
                          key={col}
                          className={
                            status === "added"
                              ? "break-all text-green-600"
                              : status === "removed"
                                ? "break-all text-red-10 opacity-60"
                                : "break-all text-black-7"
                          }
                        >
                          {hasDiff &&
                            (status === "added"
                              ? "+ "
                              : status === "removed"
                                ? "− "
                                : "\u00a0\u00a0")}
                          {col}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })()}
            </div>
            {progress > 0 && initialCachedColumns.length === 0 && (
              <div className="h-0.5 bg-black-2">
                <div
                  className="h-full bg-black-5"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
