import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-display font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:bg-soft disabled:text-inkSoft [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-stamp text-surface hover:bg-stamp/90",
        destructive: "bg-void text-surface hover:bg-void/90",
        outline:
          "border border-line bg-surface font-medium text-ink hover:border-stamp",
        secondary: "bg-soft font-medium text-inkSoft hover:bg-badgeSoft",
        ghost: "font-medium text-inkBody hover:bg-pillHover hover:text-ink",
        link: "font-medium text-stamp underline-offset-4 hover:underline",
      },
      size: {
        default: "h-control px-4 text-14",
        sm: "h-8 rounded-md px-3 text-13",
        lg: "h-10 px-[18px] text-14",
        icon: "h-control w-control",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
