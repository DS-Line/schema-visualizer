import { Panel, useReactFlow, useViewport } from "@xyflow/react"
import { Maximize2Icon, Minimize2Icon, ScanIcon } from "lucide-react"
import { type RefObject, useCallback, useEffect, useRef, useState } from "react"
import { Icons } from "../icons"

// Snap to clean percentage levels on each zoom step
const ZOOM_LEVELS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]

function getNextZoom(current: number, direction: "in" | "out") {
  if (direction === "in") {
    return (
      ZOOM_LEVELS.find((z) => z > current + 0.01) ??
      ZOOM_LEVELS[ZOOM_LEVELS.length - 1]
    )
  }
  return (
    [...ZOOM_LEVELS].reverse().find((z) => z < current - 0.01) ?? ZOOM_LEVELS[0]
  )
}

interface Props {
  containerRef: RefObject<HTMLDivElement | null>
  fullscreenRef?: RefObject<HTMLElement | null>
  sidebarCollapsed?: boolean
}

export function VisualizerControls({
  containerRef,
  fullscreenRef,
  sidebarCollapsed,
}: Props) {
  const { zoomTo, fitView } = useReactFlow()
  const { zoom } = useViewport()
  const [isFullscreen, setIsFullscreen] = useState(false)
  const isFirstRender = useRef(true)

  // biome-ignore lint/correctness/useExhaustiveDependencies: sidebarCollapsed is an intentional trigger
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const id = setTimeout(
      () => fitView({ padding: 0.15, duration: 300, maxZoom: 1 }),
      100,
    )
    return () => clearTimeout(id)
  }, [sidebarCollapsed, fitView])

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
      fitView({ padding: 0.15, duration: 300, maxZoom: 1 })
    }
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [fitView])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      const target = fullscreenRef?.current ?? containerRef.current
      target?.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [containerRef, fullscreenRef])

  const btnClass =
    "flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors cursor-pointer"

  return (
    <Panel position="bottom-center">
      <div className="flex items-center bg-cream-1 border border-black-3 rounded-lg shadow-sm text-sm font-sans px-4 py-2 gap-2.5">
        <button
          type="button"
          title="Fit view"
          onClick={() => fitView({ padding: 0.15, duration: 300, maxZoom: 1 })}
          className={btnClass}
        >
          <ScanIcon className="size-4" />
        </button>

        <div className="w-px h-4 bg-black-3" />

        <button
          type="button"
          title="Zoom out"
          onClick={() => zoomTo(getNextZoom(zoom, "out"), { duration: 200 })}
          className={btnClass}
        >
          <Icons.zoomOut className="size-4" />
        </button>

        <span className="w-12 text-center text-gray-700 tabular-nums select-none">
          {Math.round(zoom * 100)}%
        </span>

        <button
          type="button"
          title="Zoom in"
          onClick={() => zoomTo(getNextZoom(zoom, "in"), { duration: 200 })}
          className={btnClass}
        >
          <Icons.zoomIn className="size-4" />
        </button>

        <div className="w-px h-4 bg-black-3" />

        <button
          type="button"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          onClick={toggleFullscreen}
          className={btnClass}
        >
          {isFullscreen ? (
            <Minimize2Icon className="size-4" />
          ) : (
            <Maximize2Icon className="size-4" />
          )}
        </button>
      </div>
    </Panel>
  )
}
