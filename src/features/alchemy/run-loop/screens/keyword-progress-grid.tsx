// Grid of per-keyword XP progress cards with a mount-triggered entrance animation.
// Shared by the run-end progress section and the mystery reward summary.
import { useEffect, useState } from "react";
import type { KeywordId } from "@/lib/game-data";
import { KeywordProgressCard } from "./keyword-progress-card";

export interface KeywordProgressEntry {
  kw: KeywordId;
  runXP: number;
  totalXP: number;
}

export function KeywordProgressGrid({ entries }: { entries: KeywordProgressEntry[] }) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (entries.length === 0) return null;

  return (
    <div className="flex w-full max-w-2xl flex-wrap justify-center gap-2">
      {entries.map(({ kw, runXP, totalXP }) => (
        <div key={kw} className="w-[23.33cqh] flex-none">
          <KeywordProgressCard kw={kw} runXP={runXP} totalXP={totalXP} animate={animate} />
        </div>
      ))}
    </div>
  );
}
