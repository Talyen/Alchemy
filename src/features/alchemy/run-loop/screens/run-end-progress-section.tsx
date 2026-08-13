// Shared run-end talent XP and materials summary for victory and defeat screens.
import { useEffect, useMemo, useState } from "react";
import { type KeywordId, type TalentXP } from "@/lib/game-data";
import { getTalentTreeKeywordIds } from "@/lib/game-data";
import { type MaterialInventory } from "@/lib/homestead/types";
import { FoundResourcesRow } from "../../shared/ui/found-resources-row";
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

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <>
      {keywordIds.length > 0 && (
        <div className="w-full max-w-2xl">
          <div className="flex flex-wrap justify-center gap-2">
            {keywordIds.map((kw) => (
              <div key={kw} className="w-[23.33cqh] flex-none">
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

      <FoundResourcesRow materials={runEndMaterials} />
    </>
  );
}
