import IcomoonReact from "icomoon-react"

import { cn } from "../../lib/utils"

import iconSet from "./selection.json"

interface IconProps {
  color?: string
  size: string | number
  icon: string
  className?: string
  hasDatatestId?: boolean
  datatestid?: string
}

function Icon(props: IconProps) {
  const {
    color = "currentColor",
    size = "100%",
    icon,
    className = "",
    hasDatatestId = false,
    datatestid = "",
  } = props
  return (
    <i
      className={cn("icon-wrapper inline-flex", className)}
      data-icon={icon}
      {...(hasDatatestId ? { "data-testid": datatestid } : {})}
    >
      <IcomoonReact
        iconSet={iconSet}
        color={color}
        size={size}
        icon={icon}
        className={className}
      />
    </i>
  )
}

export default Icon
