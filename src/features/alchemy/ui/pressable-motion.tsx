// Shared hover/tap motion wrapper for non-Button controls such as tabs and pills.
// Depends on motion/react and keeps press feedback consistent across alchemy UI.
import type { ReactNode } from "react";
import { motion, type MotionStyle } from "motion/react";

import { playUISound } from "@/lib/audio";
import type { UISound } from "@/lib/sound-registry";

type PressableMotionProps = {
  children: ReactNode;
  className?: string;
  style?: MotionStyle;
  hoverSound?: UISound | false;
};

// Centralizes the spring contract so tab-like controls do not drift from Button feedback.
export function PressableMotion({ children, className, style, hoverSound }: PressableMotionProps) {
  return (
    <motion.span
      className={className}
      {...(style ? { style } : {})}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 15 }}
      onMouseEnter={() => {
        if (hoverSound !== false) playUISound(hoverSound ?? "buttonHover");
      }}
    >
      {children}
    </motion.span>
  );
}
