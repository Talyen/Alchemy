import { useMemo } from "react";
import { getTalentTreeKeywordIds, type KeywordId, type TalentXP } from "@/lib/game-data";
import type { RunObtainedItem } from "@/lib/active-run-session";
import { type MaterialInventory } from "@/lib/homestead/types";
import { FoundResourcesRow } from "../../shared/ui/found-resources-row";
import { KeywordProgressGrid } from "./keyword-progress-grid";
import { RunEndObtainedItems } from "./run-end-obtained-items";

const XP_COLUMNS = 5;

export function RunEndProgressSection({
  runEndTalentXP,
  talentXP,
  runEndMaterials,
  runEndItems,
}: {
  runEndTalentXP: TalentXP;
  talentXP: TalentXP;
  runEndMaterials: MaterialInventory;
  runEndItems: readonly RunObtainedItem[];
}) {
  const visibleKeywords = useMemo(() => new Set(getTalentTreeKeywordIds()), []);
  const entries = useMemo(
    () =>
      (Object.keys(runEndTalentXP) as KeywordId[])
        .filter((kw) => visibleKeywords.has(kw) && (runEndTalentXP[kw] ?? 0) > 0)
        .map((kw) => ({ kw, totalXP: talentXP[kw] ?? 0 })),
    [runEndTalentXP, talentXP, visibleKeywords],
  );

  return (
    <>
      {entries.length > 0 ? <KeywordProgressGrid entries={entries} size="lg" columns={XP_COLUMNS} /> : null}
      <RunEndObtainedItems items={runEndItems} />
      <FoundResourcesRow materials={runEndMaterials} size="lg" />
    </>
  );
}
