// Shared run-end talent XP and materials summary for victory and defeat screens.
import { useMemo } from "react";
import { type KeywordId, type TalentXP } from "@/lib/game-data";
import { getTalentTreeKeywordIds } from "@/lib/game-data";
import { type MaterialInventory } from "@/lib/homestead/types";
import { FoundResourcesRow } from "../../shared/ui/found-resources-row";
import { KeywordProgressGrid } from "./keyword-progress-grid";

export function RunEndProgressSection({
  runEndTalentXP,
  talentXP,
  runEndMaterials,
}: {
  runEndTalentXP: TalentXP;
  talentXP: TalentXP;
  runEndMaterials: MaterialInventory;
}) {
  const visibleKeywords = useMemo(() => new Set(getTalentTreeKeywordIds()), []);
  const entries = useMemo(
    () =>
      (Object.keys(runEndTalentXP) as KeywordId[])
        .filter((kw) => visibleKeywords.has(kw) && (runEndTalentXP[kw] ?? 0) > 0)
        .map((kw) => ({ kw, runXP: runEndTalentXP[kw] ?? 0, totalXP: talentXP[kw] ?? 0 })),
    [runEndTalentXP, talentXP, visibleKeywords],
  );

  return (
    <>
      <KeywordProgressGrid entries={entries} />
      <FoundResourcesRow materials={runEndMaterials} />
    </>
  );
}
