// Game over screen — shows defeat message and talent XP earned this run.
import { useState, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { keywordDefinitions, type KeywordId } from "@/lib/game-data";
import { computeTalentPoints, xpForNextPoint, xpToNextPoint } from "@/lib/talents";
import { MATERIAL_IDS, materialLabels } from "@/lib/homestead/types";

import { keywordIcons } from "../config";
import { ProgressBar, ScreenHeader } from "../ui/shared-ui";
import { matIconMap, matPillStyle, matTextColor } from "../ui/material-icons";
import { useRunStore } from "../stores/run-store";
import { useScreenStore } from "../stores/screen-store";

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
    <div className="surface-muted rounded-[14px] border border-border/70 p-3 text-left">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {Icon ? <Icon className={cn("h-3.5 w-3.5", def?.colorClass)} /> : null}
          <span className={cn("text-xs font-semibold", def?.colorClass)}>{def?.label ?? kw}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">+{runXP}</span>
      </div>
      <ProgressBar
        value={animate ? percent : 0}
        className="mt-2"
        color="bg-primary"
        style={{
          transition: animate ? "width 1000ms ease-out" : "none",
          backgroundColor: def?.shineColors?.[0] ?? undefined,
        }}
      />
      <p className="mt-1 text-right text-[10px] text-muted-foreground">
        {nextXP - progress}/{nextXP}
      </p>
    </div>
  );
}

export function GameOverScreen({ onMainMenu }: { onMainMenu: () => void }) {
  const { runTalentXP, talentXP } = useRunStore(
    useShallow((s) => ({ runTalentXP: s.runTalentXP, talentXP: s.talentXP })),
  );
  const runEndMaterials = useScreenStore((s) => s.runEndMaterials);
  const [animate, setAnimate] = useState(false);
  const keywordIds = (Object.keys(runTalentXP) as KeywordId[]).filter(
    (kw) => !keywordDefinitions[kw]?.hidden && (runTalentXP[kw] ?? 0) > 0,
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <div>
        <ScreenHeader title="Defeat" />
        <p className="mt-3 text-lg text-muted-foreground">Your run has ended.</p>
      </div>

      {keywordIds.length > 0 && (
        <div className="w-full max-w-2xl">
          <div className="flex flex-wrap justify-center gap-2">
            {keywordIds.map((kw) => (
              <div key={kw} className="flex-none w-[210px]">
                <KeywordProgressCard
                  kw={kw}
                  runXP={runTalentXP[kw] ?? 0}
                  totalXP={talentXP[kw] ?? 0}
                  animate={animate}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {MATERIAL_IDS.filter((mat) => runEndMaterials[mat] > 0).length > 0 && (
        <div className="flex flex-col items-center gap-2">
          {MATERIAL_IDS.filter((mat) => runEndMaterials[mat] > 0).map((mat) => (
            <span key={mat} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
              Found
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                  matPillStyle[mat],
                  matTextColor[mat],
                )}
              >
                {matIconMap[mat]}
                {runEndMaterials[mat]} {materialLabels[mat]}
              </span>
            </span>
          ))}
        </div>
      )}

      <Button size="lg" className="min-w-44" onClick={onMainMenu}>
        Return to Main Menu
      </Button>
    </div>
  );
}
