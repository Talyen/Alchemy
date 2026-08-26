import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const shineTextClass = "boss-title-shine [background-size:200%_100%] bg-clip-text text-transparent";

export function ShineText({
  children,
  gradient,
  className,
  fallbackClassName = "text-stone-100",
}: {
  children: ReactNode;
  gradient: string | null;
  className?: string | undefined;
  fallbackClassName?: string | undefined;
}) {
  if (!gradient) {
    return <span className={cn(fallbackClassName, className)}>{children}</span>;
  }

  return (
    <span className={cn(shineTextClass, className)} style={{ backgroundImage: gradient }}>
      {children}
    </span>
  );
}
