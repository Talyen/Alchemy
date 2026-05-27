// Styled button primitive with variant/size class composition and optional Radix Slot rendering.
// Depends on class-variance-authority, Radix Slot, React, and cn utilities.
// Used across game screens as the base clickable control.
import { type ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "motion/react";

import { playUISound } from "@/lib/audio";
import type { UISound } from "@/lib/sound-registry";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border border-border/80 bg-background text-foreground",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-4 text-xs uppercase tracking-widest",
        lg: "h-12 px-6 text-base",
        icon: "h-11 w-11",
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

// Mirrors only layout-affecting utilities onto the motion wrapper because it becomes
// the flex/grid item while the inner button keeps the visual styling classes.
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

// Strips positioning utilities from the inner button so they live only on the motion
// wrapper. Without this, hover transforms on the wrapper create a new containing block
// and the inner button's absolute positioning teleports between ancestors.
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

  return (
    <motion.span
      className={cn("inline-flex", wrapperClassName)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 15 }}
    >
      {button}
    </motion.span>
  );
};

export { Button };
