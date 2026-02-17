import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
} from "@xyflow/react"
import { XIcon } from "lucide-react"
import { memo, useState } from "react"

interface RefEdgeProps extends EdgeProps {
  data?: {
    refId?: string
    onDelete?: (edgeId: string) => void
  }
}

export const RefEdge = memo<RefEdgeProps>(
  ({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    markerEnd,
    style,
    data,
  }: RefEdgeProps) => {
    const [isHovered, setIsHovered] = useState(false)

    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    })

    const onEdgeDelete = () => {
      // Use the callback if provided
      if (data?.onDelete && data?.refId) {
        data.onDelete(data.refId)
      }
    }

    return (
      <>
        {/** biome-ignore lint/a11y/noStaticElementInteractions: needed here */}
        <g
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Invisible wider path for easier hover detection */}
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
              strokeWidth: 2,
              stroke: "#35383D",
              pointerEvents: "none",
            }}
          />
        </g>

        {/* Delete button - only show on hover */}
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
              className="cursor-pointer bg-gray-700 text-gray-300 rounded-full p-1"
            >
              <XIcon className="size-3" />
            </button>
          </EdgeLabelRenderer>
        )}
      </>
    )
  },
)

RefEdge.displayName = "RefEdge"
