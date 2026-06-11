// Shared run-end talent XP and materials summary for victory and defeat screens.
import { useEffect, useMemo, useState } from "react";
import { type KeywordId, type TalentXP } from "@/lib/game-data";
import { getTalentTreeKeywordIds } from "@/lib/game-data";
import { MATERIAL_IDS, type MaterialInventory } from "@/lib/homestead/types";
import { MaterialPill } from "../../shared/ui/material-icons";
import { StaggerGroup, StaggerItem } from "../../shared/ui/shared-ui";
import { KeywordProgressCard } from "./keyword-progress-card";

export function RunEndProgressSection({
  runEndTalentXP,
  talentXP,
  runEndMaterials,
}: {
  runEndTalentXP: TalentXP;
  talentXP: TalentXP;
  runEndMaterials: MaterialInventory;
}) {
  const [animate, setAnimate] = useState(false);
  const visibleKeywords = useMemo(() => new Set(getTalentTreeKeywordIds()), []);
  const keywordIds = useMemo(
    () =>
      (Object.keys(runEndTalentXP) as KeywordId[]).filter(
        (kw) => visibleKeywords.has(kw) && (runEndTalentXP[kw] ?? 0) > 0,
      ),
    [runEndTalentXP, visibleKeywords],
  );
  const earnedMaterials = useMemo(() => MATERIAL_IDS.filter((mat) => runEndMaterials[mat] > 0), [runEndMaterials]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <>
      {keywordIds.length > 0 && (
        <StaggerGroup className="w-full max-w-2xl">
          <div className="flex flex-wrap justify-center gap-2">
            {keywordIds.map((kw, index) => (
              <StaggerItem key={kw} index={index} className="flex-none w-[19.44cqh]">
                <KeywordProgressCard
                  kw={kw}
                  runXP={runEndTalentXP[kw] ?? 0}
                  totalXP={talentXP[kw] ?? 0}
                  animate={animate}
                />
              </StaggerItem>
            ))}
          </div>
        </StaggerGroup>
      )}

      {earnedMaterials.length > 0 && (
        <StaggerGroup className="flex flex-wrap items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
          <StaggerItem index={0}>Found</StaggerItem>
          {earnedMaterials.map((mat, index) => (
            <StaggerItem key={mat} index={index + 1}>
              <MaterialPill material={mat} amount={runEndMaterials[mat]} />
            </StaggerItem>
          ))}
        </StaggerGroup>
      )}
    </>
  );
}
