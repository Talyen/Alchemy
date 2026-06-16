// Shared hover-sound wrapper for non-Button controls such as tabs and choice chips.
// Tap feedback is CSS-only on child elements; no hover scale.
import type { ReactNode } from "react";

import { playUISound } from "@/lib/audio";
import type { UISound } from "@/lib/sound-registry";

type PressableMotionProps = {
  children: ReactNode;
  className?: string;
  hoverSound?: UISound | false;
};

export function PressableMotion({ children, className, hoverSound }: PressableMotionProps) {
  return (
    <span
      className={className}
      onMouseEnter={() => {
        if (hoverSound !== false) playUISound(hoverSound ?? "buttonHover");
      }}
    >
      {children}
    </span>
  );
}
