import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-field w-full rounded border border-line bg-surface px-[13px] text-14 text-ink transition-colors file:mr-3 file:h-8 file:rounded-md file:border file:border-line file:bg-soft file:px-3 file:font-display file:text-13 file:text-ink placeholder:text-inkMute hover:border-stamp/40 focus-visible:border-stamp focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/25 disabled:cursor-not-allowed disabled:bg-soft disabled:text-inkSoft aria-[invalid=true]:border-void",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
