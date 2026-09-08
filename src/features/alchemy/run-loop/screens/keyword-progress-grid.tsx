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
  className,
}: {
  entries: KeywordProgressEntry[];
  size?: "md" | "lg";
  className?: string;
}) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (entries.length === 0) return null;

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[calc(73*var(--content-rem,1rem))] flex-wrap justify-center gap-3",
        className,
      )}
    >
      {entries.map(({ kw, totalXP }) => (
        <div key={kw} className="w-56 flex-none">
          <KeywordProgressCard kw={kw} totalXP={totalXP} animate={animate} size={size} />
        </div>
      ))}
    </div>
  );
}
