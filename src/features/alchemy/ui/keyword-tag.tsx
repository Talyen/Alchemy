import type { KeywordId } from "@/lib/game-data";
import { keywordDefinitions } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { keywordIcons } from "../config";

export function KeywordTag({
  keywordId,
  pill = false,
  showIcon = true,
  className,
}: {
  keywordId: KeywordId;
  pill?: boolean;
  showIcon?: boolean;
  className?: string;
}) {
  const def = keywordDefinitions[keywordId];
  const Icon = keywordIcons[keywordId];
  if (!def) return keywordId;

  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 font-semibold text-[0.875em] leading-none",
        def.colorClass,
        pill && "rounded-full px-2.5 py-1",
        className,
      )}
      style={pill ? { backgroundColor: "color-mix(in srgb, currentColor 15%, transparent)" } as React.CSSProperties : undefined}
    >
      {showIcon ? <Icon className={cn("relative top-[0.15em] h-[1em] w-[1em] shrink-0", pill && "top-0 h-3 w-3")} /> : null}
      {def.label}
    </span>
  );
}
