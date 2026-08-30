import type { CSSProperties, ReactNode } from "react";

import { buildSmoothShineGradient } from "@/lib/animation/shine-gradient";
import { cn } from "@/lib/utils";

const shineTextClass = "boss-title-shine [background-size:200%_100%] bg-clip-text text-transparent";

export function ShineText({
  children,
  colors,
  className,
  fallbackClassName = "text-stone-100",
}: {
  children: ReactNode;
  colors: readonly string[];
  className?: string | undefined;
  fallbackClassName?: string | undefined;
}) {
  const gradient = buildSmoothShineGradient(colors);
  if (!gradient) {
    return <span className={cn(fallbackClassName, className)}>{children}</span>;
  }

  const style: CSSProperties = {
    backgroundImage: gradient,
  };

  return (
    <span className={cn(shineTextClass, className)} style={style}>
      {children}
    </span>
  );
}
