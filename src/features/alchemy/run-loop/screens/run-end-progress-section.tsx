// Shared run-end talent XP, obtained items, and materials summary for victory and defeat screens.
import { useMemo } from "react";
import { getTalentTreeKeywordIds, type KeywordId, type TalentXP } from "@/lib/game-data";
import type { RunObtainedItem } from "@/lib/active-run-session";
import { type MaterialInventory } from "@/lib/homestead/types";
import { FoundResourcesRow } from "../../shared/ui/found-resources-row";
import { FadeSlot } from "../../shared/ui/fade-slot";
import { FlankingPagination } from "../../shared/ui/navigation";
import { usePaginatedRows } from "../../shared/ui/use-paginated-rows";
import { KeywordProgressGrid } from "./keyword-progress-grid";
import { RunEndObtainedItems } from "./run-end-obtained-items";

const XP_PAGE_SIZE = 10;
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
        .map((kw) => ({ kw, runXP: runEndTalentXP[kw] ?? 0, totalXP: talentXP[kw] ?? 0 })),
    [runEndTalentXP, talentXP, visibleKeywords],
  );
  const xpPages = usePaginatedRows(entries, XP_PAGE_SIZE, XP_COLUMNS);
  const xpPaging = entries.length > XP_PAGE_SIZE;

  return (
    <>
      {entries.length > 0 ? (
        <FlankingPagination page={xpPages.page} totalPages={xpPages.totalPages} onPageChange={xpPages.setPage}>
          <FadeSlot swapKey={`run-end-xp-${xpPages.page}`} className={xpPaging ? "min-h-[24cqh]" : undefined}>
            <KeywordProgressGrid entries={xpPages.pageItems} size="lg" columns={XP_COLUMNS} />
          </FadeSlot>
        </FlankingPagination>
      ) : null}
      <RunEndObtainedItems items={runEndItems} />
      <FoundResourcesRow materials={runEndMaterials} size="lg" />
    </>
  );
}
