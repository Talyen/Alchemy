import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Tint stays inside the artwork; frames, information, and feedback are siblings. */
export function BattleSceneArtwork({
  children,
  className,
  maskSource,
  maskFit = "contain",
}: {
  children: ReactNode;
  className?: string;
  maskSource?: string;
  maskFit?: "contain" | "cover";
}) {
  return (
    <div
      className={cn("battle-scene-artwork relative", className)}
      data-scene-masked={maskSource ? "" : undefined}
      style={
        maskSource
          ? ({ "--battle-art-mask": `url("${maskSource}")`, "--battle-art-mask-fit": maskFit } as CSSProperties)
          : undefined
      }
    >
      {children}
    </div>
  );
}
