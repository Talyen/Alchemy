// Styled button primitive with variant/size class composition and optional Radix Slot rendering.
// Depends on class-variance-authority, Radix Slot, React, and cn utilities.
// Used across game screens as the base clickable control.
import { type ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { playUISound } from "@/lib/audio";
import type { UISound } from "@/lib/sound-registry";
import {
  BUTTON_HOVER_DESTRUCTIVE,
  BUTTON_HOVER_PRIMARY,
  BUTTON_HOVER_SECONDARY,
  BUTTON_HOVER_TRANSITION,
  BUTTON_PRESS_OUTLINE,
} from "@/lib/ui/button-hover";
import { cn } from "@/lib/utils";

const primaryVariantClasses = cn(
  "bg-primary text-primary-foreground active:bg-primary/90 active:brightness-100",
  BUTTON_HOVER_PRIMARY,
);

const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-2 rounded-xl text-base font-semibold whitespace-nowrap disabled:pointer-events-none disabled:opacity-50",
    BUTTON_HOVER_TRANSITION,
  ),
  {
    variants: {
      variant: {
        default: primaryVariantClasses,
        primary: primaryVariantClasses,
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
      variant: "default",
      size: "default",
    },
  },
);

const positioningPrefixes = [
  "absolute",
  "relative",
  "fixed",
  "sticky",
  "left-",
  "right-",
  "top-",
  "bottom-",
  "inset-",
  "z-",
];

const sizingPrefixes = [
  "basis-",
  "col-",
  "flex-",
  "grow",
  "h-",
  "max-h-",
  "max-w-",
  "min-h-",
  "min-w-",
  "order-",
  "row-",
  "shrink",
  "w-",
];

const wrapperLayoutClassPrefixes = [...positioningPrefixes, ...sizingPrefixes];

function getWrapperLayoutClassName(className: string | undefined) {
  if (!className) return undefined;
  return className
    .split(/\s+/)
    .filter((token) => {
      const baseToken = token.slice(token.lastIndexOf(":") + 1);
      return wrapperLayoutClassPrefixes.some(
        (prefix) => baseToken === prefix.slice(0, -1) || baseToken.startsWith(prefix),
      );
    })
    .join(" ");
}

function getVisualClassName(className: string | undefined) {
  if (!className) return undefined;
  return className
    .split(/\s+/)
    .filter((token) => {
      const baseToken = token.slice(token.lastIndexOf(":") + 1);
      return !positioningPrefixes.some((prefix) => baseToken === prefix.slice(0, -1) || baseToken.startsWith(prefix));
    })
    .join(" ");
}

interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  hoverSound?: UISound | false;
}

const Button = ({
  className,
  variant,
  size,
  asChild = false,
  hoverSound,
  onMouseEnter,
  ref,
  ...props
}: ButtonProps) => {
  const wrapperClassName = getWrapperLayoutClassName(className);
  const visualClassName = getVisualClassName(className);
  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (hoverSound !== false) playUISound(hoverSound ?? "buttonHover");
    onMouseEnter?.(e);
  };
  const button = (
    <button
      className={cn(buttonVariants({ variant, size, className: visualClassName }), size !== "icon" && "w-full")}
      ref={ref}
      onMouseEnter={handleMouseEnter}
      {...props}
    />
  );

  if (asChild) {
    return (
      <Slot
        className={cn(buttonVariants({ variant, size, className: visualClassName }))}
        ref={ref}
        onMouseEnter={handleMouseEnter}
        {...props}
      />
    );
  }

  return <span className={cn("inline-flex", wrapperClassName)}>{button}</span>;
};

export { Button };
