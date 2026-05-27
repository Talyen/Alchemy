// Floating combat text widgets for battle feedback.
// Depends on motion, combat text UI types, and presentation formatting helpers.
// Used by BattleScreen actor rails.
import { createElement } from "react";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/utils";

import type { FloatingCombatText } from "../../types";
import { getCombatTextColorClass, getCombatTextIcon } from "../../utils";

// Renders a side-specific rail of active combat text bubbles.
export function CombatTextRail({ entries, side }: { entries: FloatingCombatText[]; side: "player" | "enemy" }) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none relative z-30 h-24 w-full",
        side === "player" ? "flex justify-end" : "flex justify-start",
      )}
    >
      <AnimatePresence>
        {entries.map((entry) => (
          <CombatTextBubble key={entry.id} entry={entry} side={side} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function CombatTextBubble({ entry, side }: { entry: FloatingCombatText; side: "player" | "enemy" }) {
  const icon = getCombatTextIcon(entry);
  const colorClass = getCombatTextColorClass(entry);

  // Lane spacing and the 1.6s travel duration match the combat-text lifetime in hooks;
  // merged multi-hit text can float together without overlapping newer entries.
  return (
    <motion.div
      className={cn(
        "absolute whitespace-nowrap inline-flex items-center gap-2 text-[2.96cqh] font-semibold",
        colorClass,
        side === "player" ? "left-0" : "right-0",
      )}
      // Lane offset is per floating entry — static utilities can't encode the runtime stack index.
      style={
        {
          top: `${entry.lane * 56}px`,
        } as Record<string, string>
      }
      initial={{ y: 0, opacity: 1, filter: "blur(0px)", scale: 1 }}
      animate={{
        y: -120,
        opacity: [1, 1, 0],
        filter: ["blur(0px)", "blur(0px)", "blur(4px)"],
        scale: [1, 1, 1.3],
        transition: {
          y: { duration: 1.6, ease: "easeOut" },
          opacity: { duration: 1.6, times: [0, 0.4, 1], ease: "easeOut" },
          filter: { duration: 1.6, times: [0, 0.4, 1], ease: "easeOut" },
          scale: { duration: 1.6, times: [0, 0.5, 1], ease: "easeOut" },
        },
      }}
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
    >
      {createElement(icon, { className: "h-[2.78cqh] w-[2.78cqh]" })}
      <span>{entry.displayText}</span>
    </motion.div>
  );
}
