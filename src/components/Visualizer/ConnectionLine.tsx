import { type ConnectionLineComponent, getBezierPath } from "@xyflow/react"
import { NODE_WIDTH } from "../../lib/layout"

export const ConnectionLine: ConnectionLineComponent = ({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  toNode,
}) => {
  // Adjust x coordinates from the full-width handle to the node edge
  const adjustedFromX =
    toX > fromX ? fromX + NODE_WIDTH / 2 : fromX - NODE_WIDTH / 2
  const adjustedToX = toNode
    ? toX > fromX
      ? toX - NODE_WIDTH / 2
      : toX + NODE_WIDTH / 2
    : toX

  const [edgePath] = getBezierPath({
    sourceX: adjustedFromX,
    sourceY: fromY,
    targetX: adjustedToX,
    targetY: toY,
    sourcePosition: fromPosition,
    targetPosition: toPosition,
  })

  return (
    <g>
      <path
        fill="none"
        stroke="#4da6a6"
        strokeWidth={2}
        className="animated"
        d={edgePath}
      />
      <circle
        cx={adjustedToX}
        cy={toY}
        fill="#fff"
        r={3}
        stroke="#4da6a6"
        strokeWidth={1.5}
      />
    </g>
  )
}
