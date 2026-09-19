import { type ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Hover layers live with the primitive that owns them. Previously these
// strings were split across game-constants/ui-layout.ts and re-imported
// here for a single consumer.
const BUTTON_HOVER_TRANSITION = "transition-[color,background-color,border-color,box-shadow] duration-150";
const BUTTON_HOVER_PRIMARY = "button-primary-bloom";
const BUTTON_HOVER_DESTRUCTIVE = "hover:bg-destructive/90";
// Secondary and ghost fills stay fully opaque so background plasma and
// particles never show through a button. Feedback uses solid fills, never
// reduced alpha or filters (filters re-rasterize the scaled stage).
const BUTTON_HOVER_SECONDARY = "hover:bg-muted";
const BUTTON_PRESS_SECONDARY = "active:bg-accent";

const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-2 rounded-xl text-base font-semibold whitespace-nowrap disabled:pointer-events-none disabled:opacity-50",
    BUTTON_HOVER_TRANSITION,
  ),
  {
    variants: {
      variant: {
        primary: cn(
          "bg-primary text-primary-foreground active:bg-primary/90 active:brightness-100",
          BUTTON_HOVER_PRIMARY,
        ),
        destructive: cn(
          "bg-destructive text-destructive-foreground active:bg-destructive/80 active:brightness-95",
          BUTTON_HOVER_DESTRUCTIVE,
        ),
        outline: cn(
          "border border-border/90 bg-background text-foreground/80 hover:border-border hover:text-foreground",
          BUTTON_HOVER_SECONDARY,
          BUTTON_PRESS_SECONDARY,
        ),
        ghost: cn("border-0 bg-background text-foreground", BUTTON_HOVER_SECONDARY, BUTTON_PRESS_SECONDARY),
      },
      size: {
        default: "h-14 px-6",
        sm: "h-11 px-4 text-sm tracking-widest uppercase",
        lg: "h-16 px-7 text-xl",
        icon: "h-14 w-14",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  wrapperClassName?: string;
}

function Button({ className, wrapperClassName, variant, size, type = "button", ref, ...props }: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  const button = <button type={type} className={classes} ref={ref} {...props} />;
  return wrapperClassName ? <span className={cn("inline-flex", wrapperClassName)}>{button}</span> : button;
}

export { Button };
