import { type ConnectionLineComponent, getBezierPath } from "@xyflow/react"

export const RefLine: ConnectionLineComponent = ({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  toNode,
}) => {
  const handleWidth = 288

  let adjustedFromX = fromX
  let adjustedToX = toX

  // Always adjust the start point
  if (toX > fromX) {
    adjustedFromX = fromX + handleWidth / 2
  } else {
    adjustedFromX = fromX - handleWidth / 2
  }

  // Only adjust the end point if hovering over a target node
  if (toNode) {
    if (toX > fromX) {
      adjustedToX = toX - handleWidth / 2
    } else {
      adjustedToX = toX + handleWidth / 2
    }
  } else {
    adjustedToX = toX
  }

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
        stroke="#35383D"
        strokeWidth={2}
        className="animated"
        d={edgePath}
      />
      <circle
        cx={adjustedToX}
        cy={toY}
        fill="#fff"
        r={3}
        stroke="#35383D"
        strokeWidth={1.5}
      />
    </g>
  )
}
