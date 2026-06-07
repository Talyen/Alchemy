// Game over screen — shows defeat message and talent XP earned this run.
import { useState, useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  keywordDefinitions,
  type KeywordId,
  computeTalentPoints,
  xpForNextPoint,
  xpToNextPoint,
  type TalentXP,
} from "@/lib/game-data";
import { MATERIAL_IDS } from "@/lib/homestead/types";

import { keywordIcons } from "@/features/alchemy/shared/config";
import { ScreenHeader } from "../../shared/ui/shared-ui";
import { MaterialPill } from "../../shared/ui/material-icons";
import type { MaterialInventory } from "@/lib/homestead/types";

export function KeywordProgressCard({
  kw,
  runXP,
  totalXP,
  animate,
}: {
  kw: KeywordId;
  runXP: number;
  totalXP: number;
  animate: boolean;
}) {
  const points = computeTalentPoints(totalXP);
  const nextXP = xpForNextPoint(points);
  const progress = xpToNextPoint(totalXP);
  const percent = Math.min(100, Math.round(((nextXP - progress) / nextXP) * 100));
  const Icon = keywordIcons[kw];
  const def = keywordDefinitions[kw];

  return (
    <div className="surface-muted rounded-shell-compact border border-border/70 p-3 text-left">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {Icon ? <Icon className={cn("h-3.5 w-3.5", def?.colorClass)} /> : null}
          <span className={cn("text-xs font-semibold", def?.colorClass)}>{def?.label ?? kw}</span>
        </div>
        <span className="text-xs font-semibold text-muted-foreground">+{runXP}</span>
      </div>
      <Progress
        size="sm"
        value={animate ? percent : 0}
        className="mt-2"
        fillStyle={{
          transition: animate ? "width 1000ms ease-out" : "none",
          backgroundColor: def?.shineColors?.[0] ?? undefined,
        }}
      />
      <p className="mt-1 text-right text-xs font-semibold text-muted-foreground">
        {nextXP - progress}/{nextXP}
      </p>
    </div>
  );
}

export function GameOverScreen({
  runEndTalentXP,
  talentXP,
  runEndMaterials,
  onMainMenu,
}: {
  runEndTalentXP: TalentXP;
  talentXP: TalentXP;
  runEndMaterials: MaterialInventory;
  onMainMenu: () => void;
}) {
  const [animate, setAnimate] = useState(false);
  const keywordIds = useMemo(
    () =>
      (Object.keys(runEndTalentXP) as KeywordId[]).filter(
        (kw) => !keywordDefinitions[kw]?.hidden && (runEndTalentXP[kw] ?? 0) > 0,
      ),
    [runEndTalentXP],
  );
  const earnedMaterials = useMemo(() => MATERIAL_IDS.filter((mat) => runEndMaterials[mat] > 0), [runEndMaterials]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <div>
        <ScreenHeader title="Defeat" />
        <p className="mt-3 text-sm text-muted-foreground">Your run has ended.</p>
      </div>

      {keywordIds.length > 0 && (
        <div className="w-full max-w-2xl">
          <div className="flex flex-wrap justify-center gap-2">
            {keywordIds.map((kw) => (
              <div key={kw} className="flex-none w-[19.44cqh]">
                <KeywordProgressCard
                  kw={kw}
                  runXP={runEndTalentXP[kw] ?? 0}
                  totalXP={talentXP[kw] ?? 0}
                  animate={animate}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {earnedMaterials.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
          Found
          {earnedMaterials.map((mat) => (
            <MaterialPill key={mat} material={mat} amount={runEndMaterials[mat]} />
          ))}
        </div>
      )}

      <Button size="lg" className="min-w-44" onClick={onMainMenu}>
        Return to Main Menu
      </Button>
    </div>
  );
}
