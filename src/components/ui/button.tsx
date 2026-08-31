import { type ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import {
  BUTTON_HOVER_DESTRUCTIVE,
  BUTTON_HOVER_PRIMARY,
  BUTTON_HOVER_SECONDARY,
  BUTTON_HOVER_TRANSITION,
  BUTTON_PRESS_OUTLINE,
} from "@/lib/ui/button-hover";
import { cn } from "@/lib/utils";

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
          "bg-destructive text-destructive-foreground active:bg-destructive/90 active:brightness-100",
          BUTTON_HOVER_DESTRUCTIVE,
        ),
        outline: cn(
          "border border-border/80 bg-background text-foreground active:bg-muted/90 active:brightness-100",
          BUTTON_HOVER_SECONDARY,
          BUTTON_PRESS_OUTLINE,
        ),
        ghost: cn(
          "border-0 bg-transparent text-foreground active:bg-muted/90 active:brightness-100",
          BUTTON_HOVER_SECONDARY,
        ),
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
  asChild?: boolean;
  wrapperClassName?: string;
}

function Button({ className, wrapperClassName, variant, size, asChild = false, ref, ...props }: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    const slot = <Slot className={classes} ref={ref} {...props} />;
    return wrapperClassName ? <span className={cn("inline-flex", wrapperClassName)}>{slot}</span> : slot;
  }

  if (wrapperClassName) {
    return (
      <span className={cn("inline-flex", wrapperClassName)}>
        <button className={classes} ref={ref} {...props} />
      </span>
    );
  }

  return <button className={classes} ref={ref} {...props} />;
}

export { Button };
