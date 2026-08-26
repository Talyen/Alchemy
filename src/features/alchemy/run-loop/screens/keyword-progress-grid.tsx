// Grid of per-keyword XP progress cards with a mount-triggered entrance animation.
// Shared by the run-end progress section and the mystery reward summary.
import { useEffect, useState } from "react";
import type { KeywordId } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { KeywordProgressCard } from "./keyword-progress-card";

export interface KeywordProgressEntry {
  kw: KeywordId;
  runXP: number;
  totalXP: number;
}

export function KeywordProgressGrid({
  entries,
  size = "md",
  columns,
  className,
}: {
  entries: KeywordProgressEntry[];
  size?: "md" | "lg";
  columns?: 3;
  className?: string;
}) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (entries.length === 0) return null;

  if (columns === 3) {
    return (
      <div className={cn("grid w-full grid-cols-3 gap-3", className)}>
        {entries.map(({ kw, runXP, totalXP }) => (
          <KeywordProgressCard key={kw} kw={kw} runXP={runXP} totalXP={totalXP} animate={animate} size={size} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex w-full max-w-2xl flex-wrap justify-center gap-2", className)}>
      {entries.map(({ kw, runXP, totalXP }) => (
        <div key={kw} className="w-[23.33cqh] flex-none">
          <KeywordProgressCard kw={kw} runXP={runXP} totalXP={totalXP} animate={animate} size={size} />
        </div>
      ))}
    </div>
  );
}
