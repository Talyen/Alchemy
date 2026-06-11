// Panel enter + remount key for replaying staggered child animations (collection grid pattern).
import type { ElementType, HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type StaggerGroupProps<T extends ElementType = "div"> = {
  as?: T;
  /** Remount this group when content identity changes so child stagger animations replay. */
  swapKey?: string | number;
  /** Apply state-swap panel enter animation. Default true. Set false on nested grids inside another StaggerGroup. */
  animate?: boolean;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>;

export function StaggerGroup<T extends ElementType = "div">({
  as,
  swapKey,
  animate = true,
  className,
  children,
  ...props
}: StaggerGroupProps<T>) {
  const Component = as ?? "div";
  return (
    <Component key={swapKey} className={cn(animate && "state-swap", className)} {...props}>
      {children}
    </Component>
  );
}
