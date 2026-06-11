// Staggered enter animation wrapper — applies stagger-item CSS with --stagger-index.
// Must wrap motion components (Button, PressableMotion); never put stagger-item on them directly.
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type StaggerItemProps = HTMLAttributes<HTMLDivElement> & {
  index: number;
  children: ReactNode;
};

export function StaggerItem({ index, className, children, style, ...props }: StaggerItemProps) {
  return (
    <div
      className={cn("stagger-item", className)}
      style={{ ...style, "--stagger-index": index } as CSSProperties}
      {...props}
    >
      {children}
    </div>
  );
}
