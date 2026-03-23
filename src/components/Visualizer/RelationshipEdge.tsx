import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
} from "@xyflow/react"
import { XIcon } from "lucide-react"
import { memo, useState } from "react"

interface RelationshipEdgeProps extends EdgeProps {
  data?: {
    refId?: string
    onDelete?: (edgeId: string) => void
    isSelected?: boolean
    onSelect?: (edgeId: string) => void
  }
}

export const RelationshipEdge = memo<RelationshipEdgeProps>(
  ({
    id,
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    markerEnd,
    style,
    data,
  }: RelationshipEdgeProps) => {
    const [isHovered, setIsHovered] = useState(false)
    const isSelected = data?.isSelected ?? false

    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    })

    const onEdgeDelete = () => {
      if (data?.onDelete && data?.refId) {
        data.onDelete(data.refId)
      }
    }

    return (
      <>
        <style>{`@keyframes dash-flow { from { stroke-dashoffset: 24 } to { stroke-dashoffset: 0 } }`}</style>
        <style>{`.arrow { filter: none }`}</style>
        {/** biome-ignore lint/a11y/noStaticElementInteractions: needed here */}
        <g
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => data?.onSelect?.(id)}
          style={{ cursor: "pointer" }}
        >
          {/* Invisible wider path for easier hover/click detection */}
          <path
            d={edgePath}
            fill="none"
            strokeWidth={20}
            stroke="transparent"
            style={{ cursor: "pointer" }}
          />

          {/* Visible edge path */}
          <BaseEdge
            path={edgePath}
            markerEnd={markerEnd}
            style={{
              ...style,
              strokeWidth: isSelected ? 2.5 : 2,
              stroke: isSelected ? "#4da6a6" : "#626468",
              strokeDasharray: isSelected ? "8 4" : "none",
              animation: isSelected ? "dash-flow 1s linear infinite" : "none",
              transition: "stroke 0.15s ease, stroke-width 0.15s ease",
              pointerEvents: "none",
            }}
          />
        </g>

        {/* Delete button — only shown on hover */}
        {isHovered && (
          <EdgeLabelRenderer>
            <button
              type="button"
              title="Delete Relationship"
              onClick={onEdgeDelete}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              style={{
                position: "absolute",
                transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                pointerEvents: "all",
              }}
              className="cursor-pointer bg-red-10 text-white-1 rounded-full p-1"
            >
              <XIcon className="size-3" />
            </button>
          </EdgeLabelRenderer>
        )}
      </>
    )
  },
)

RelationshipEdge.displayName = "RelationshipEdge"
