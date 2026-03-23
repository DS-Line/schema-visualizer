import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const toastVariants = cva("px-4 py-3 rounded-lg text-xs", {
  variants: {
    variant: {
      default: "bg-green-1",
      warning: "bg-orange-2",
      destructive: "bg-red-2",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

interface Props extends VariantProps<typeof toastVariants> {
  message: string
  className?: string
}

export function Toast({ message, variant, className }: Props) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-200 w-max max-w-xs">
      <div className={cn(toastVariants({ variant }), className)}>{message}</div>
    </div>
  )
}
