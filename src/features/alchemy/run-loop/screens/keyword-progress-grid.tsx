import { useEffect, useState } from "react";
import type { KeywordId } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { KeywordProgressCard } from "./keyword-progress-card";

export interface KeywordProgressEntry {
  kw: KeywordId;
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
  columns?: 3 | 4 | 5;
  className?: string;
}) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (entries.length === 0) return null;

  if (columns) {
    return (
      <div className={cn("mx-auto flex w-full max-w-[73rem] flex-wrap justify-center gap-3", className)}>
        {entries.map(({ kw, totalXP }) => (
          <div key={kw} className="w-56 flex-none">
            <KeywordProgressCard kw={kw} totalXP={totalXP} animate={animate} size={size} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex w-full max-w-2xl flex-wrap justify-center gap-2", className)}>
      {entries.map(({ kw, totalXP }) => (
        <div key={kw} className="w-[23.33cqh] flex-none">
          <KeywordProgressCard kw={kw} totalXP={totalXP} animate={animate} size={size} />
        </div>
      ))}
    </div>
  );
}
