// Run victory screen — shown after defeating the Act III boss.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { keywordDefinitions, type KeywordId } from "@/lib/game-data";
import { MATERIAL_IDS, materialLabels, type MaterialInventory } from "@/lib/homestead/types";
import type { TalentXP } from "@/lib/talents";

import { ScreenHeader } from "../ui/shared-ui";
import { matIconMap, matPillStyle, matTextColor } from "../ui/material-icons";
import { KeywordProgressCard } from "./game-over-screen";

export function RunVictoryScreen({
  runTalentXP,
  talentXP,
  runEndMaterials,
  onMainMenu,
}: {
  runTalentXP: TalentXP;
  talentXP: TalentXP;
  runEndMaterials: MaterialInventory;
  onMainMenu: () => void;
}) {
  const [animate, setAnimate] = useState(false);
  const keywordIds = (Object.keys(runTalentXP) as KeywordId[]).filter((kw) => !keywordDefinitions[kw]?.hidden && (runTalentXP[kw] ?? 0) > 0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <div>
        <ScreenHeader title="Victory" />
        <p className="mt-3 text-lg text-muted-foreground">
          The primordial evils have been vanquished. Alchemy is saved.
        </p>
      </div>

      {keywordIds.length > 0 && (
        <div className="w-full max-w-2xl">
          <div className="flex flex-wrap justify-center gap-2">
            {keywordIds.map((kw) => (
              <div key={kw} className="flex-none w-[210px]">
                <KeywordProgressCard kw={kw} runXP={runTalentXP[kw] ?? 0} totalXP={talentXP[kw] ?? 0} animate={animate} />
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
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", matPillStyle[mat], matTextColor[mat])}>
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
