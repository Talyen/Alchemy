// Shared hover motion wrapper for non-Button controls such as tabs and pills.
// Tap feedback is CSS-only on child elements; this wrapper handles hover scale only.
import type { ReactNode } from "react";
import { motion, type MotionStyle } from "motion/react";

import { playUISound } from "@/lib/audio";
import type { UISound } from "@/lib/sound-registry";

type PressableMotionProps = {
  children: ReactNode;
  className?: string;
  style?: MotionStyle;
  hoverSound?: UISound | false;
  disableHoverScale?: boolean;
};

// Centralizes hover motion for non-Button controls. Tap feedback is CSS-only (see tab-bar, tiles).
export function PressableMotion({ children, className, style, hoverSound, disableHoverScale }: PressableMotionProps) {
  return (
    <motion.span
      className={className}
      {...(style ? { style } : {})}
      {...(disableHoverScale ? {} : { whileHover: { scale: 1.02 } })}
      transition={{ type: "spring", stiffness: 400, damping: 15 }}
      onMouseEnter={() => {
        if (hoverSound !== false) playUISound(hoverSound ?? "buttonHover");
      }}
    >
      {children}
    </motion.span>
  );
}
