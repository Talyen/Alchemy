// Game over screen — shows defeat message and talent XP earned this run.
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { keywordDefinitions, type KeywordId } from "@/lib/game-data";
import { computeTalentPoints, xpForNextPoint, xpToNextPoint, type TalentXP } from "@/lib/talents";

import { keywordIcons } from "../config";
import { ProgressBar } from "../ui/shared-ui";

function KeywordProgressCard({ kw, runXP, totalXP, animate }: { kw: KeywordId; runXP: number; totalXP: number; animate: boolean }) {
  const points = computeTalentPoints(totalXP);
  const nextXP = xpForNextPoint(points);
  const progress = xpToNextPoint(totalXP);
  const percent = Math.min(100, Math.round(((nextXP - progress) / nextXP) * 100));
  const Icon = keywordIcons[kw];
  const def = keywordDefinitions[kw];

  return (
    <div className="surface-muted rounded-[14px] border border-border/70 p-3 text-left">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {Icon ? <Icon className={cn("h-3.5 w-3.5", def?.colorClass)} /> : null}
          <span className={cn("text-xs font-semibold", def?.colorClass)}>{def?.label ?? kw}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">+{runXP}</span>
      </div>
      <ProgressBar value={animate ? percent : 0} className="mt-2" style={{ transition: animate ? "width 1000ms ease-out" : "none" }} />
      <p className="mt-1 text-right text-[10px] text-muted-foreground">{totalXP}/{nextXP}</p>
    </div>
  );
}

export function GameOverScreen({ runTalentXP, talentXP, onMainMenu }: { runTalentXP: TalentXP; talentXP: TalentXP; onMainMenu: () => void }) {
  const [animate, setAnimate] = useState(false);
  const keywordIds = (Object.keys(runTalentXP) as KeywordId[]).filter((kw) => (runTalentXP[kw] ?? 0) > 0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <div>
        <h1 className="text-5xl font-bold text-red-400">Defeat</h1>
        <p className="mt-3 text-lg text-muted-foreground">Your run has ended.</p>
      </div>

      {keywordIds.length > 0 ? (
        <div className="w-full max-w-2xl">
          <p className="mb-3 text-sm font-semibold text-foreground">Talent Progress This Run</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {keywordIds.map((kw) => <KeywordProgressCard key={kw} kw={kw} runXP={runTalentXP[kw] ?? 0} totalXP={(talentXP[kw] ?? 0) + (runTalentXP[kw] ?? 0)} animate={animate} />)}
          </div>
        </div>
      ) : <p className="text-sm text-muted-foreground">No talent XP earned this run.</p>}

      <Button size="lg" className="min-w-44" onClick={onMainMenu}>Return to Main Menu</Button>
    </div>
  );
}
