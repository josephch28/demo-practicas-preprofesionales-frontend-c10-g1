import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[104px] w-full resize-y rounded border border-line bg-surface px-[13px] py-3 text-14 leading-relaxed text-ink transition-colors placeholder:text-inkMute hover:border-stamp/40 focus-visible:border-stamp focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/25 disabled:cursor-not-allowed disabled:bg-soft disabled:text-inkSoft aria-[invalid=true]:border-void",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
