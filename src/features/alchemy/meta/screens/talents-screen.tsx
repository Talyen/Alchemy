// Talent screen — spend XP to unlock keyword-specific talents.
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  type KeywordId,
  getTalentsForKeyword,
  countImplementedTalents,
  getTalentKeywordProgress,
  getAllocatableTalentChoices,
  getTalentTreeKeywordIds,
  type UnlockedTalents,
  type TalentXP,
} from "@/lib/game-data";

import { TalentKeywordButton } from "../talents/talents-ui";
import {
  ConfirmationDialog,
  HamburgerTrigger,
  PageLayout,
  ScreenHeaderRow,
  ScreenShell,
} from "../../shared/ui/shared-ui";
import { playUISound } from "@/lib/audio";
import { TalentTree } from "../talents/talent-tree";

const CHIP_ROW_COUNT = 3;

function chunkIntoRows<T>(items: T[], rowCount: number): T[][] {
  const rows: T[][] = [];
  let index = 0;
  let remaining = items.length;
  for (let i = 0; i < rowCount; i++) {
    const groupsLeft = rowCount - i;
    const size = Math.ceil(remaining / groupsLeft);
    rows.push(items.slice(index, index + size));
    index += size;
    remaining -= size;
  }
  return rows;
}

export function TalentsScreen({
  talentXP,
  unlockedTalents,
  onOpenMenu,
  onUnlockTalent,
  onResetTalents,
}: {
  talentXP: TalentXP;
  unlockedTalents: UnlockedTalents;
  onOpenMenu: (rect?: DOMRect) => void;
  onUnlockTalent: (keywordId: KeywordId, talentId: string) => void;
  onResetTalents: () => void;
}) {
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordId>("physical");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const keywordIds = useMemo(() => getTalentTreeKeywordIds(), []);
  const chipRows = useMemo(() => chunkIntoRows(keywordIds, CHIP_ROW_COUNT), [keywordIds]);

  const unlockedIds = useMemo(() => unlockedTalents[selectedKeyword] ?? [], [selectedKeyword, unlockedTalents]);
  const allTalentsForKeyword = useMemo(() => getTalentsForKeyword(selectedKeyword), [selectedKeyword]);
  const allocatableIds = useMemo(
    () => new Set(getAllocatableTalentChoices(selectedKeyword, unlockedIds).map((t) => t.id)),
    [selectedKeyword, unlockedIds],
  );
  const progress = getTalentKeywordProgress(
    talentXP[selectedKeyword] ?? 0,
    unlockedIds.length,
    countImplementedTalents(selectedKeyword),
  );

  function handleUnlockTalent(talentId: string) {
    onUnlockTalent(selectedKeyword, talentId);
  }

  function handleUnlockTalentBegin() {
    playUISound("talentUnlock");
  }
  function handleReset() {
    onResetTalents();
    setShowResetConfirm(false);
  }

  return (
    <PageLayout>
      <ScreenShell>
        <ScreenHeaderRow
          title="Talents"
          trailing={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 text-muted-foreground"
                onClick={() => setShowResetConfirm(true)}
                aria-label="Reset talents"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <HamburgerTrigger onClick={onOpenMenu} label="Open talents menu" />
            </div>
          }
        />

        <div className="mt-6 flex flex-col items-center gap-2">
          {chipRows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex flex-wrap justify-center gap-2">
              {row.map((kw) => {
                const kwProgress = getTalentKeywordProgress(
                  talentXP[kw] ?? 0,
                  (unlockedTalents[kw] ?? []).length,
                  countImplementedTalents(kw),
                );
                return (
                  <TalentKeywordButton
                    key={kw}
                    keywordId={kw}
                    hasUnspent={kwProgress.hasUnspent}
                    isSelected={selectedKeyword === kw}
                    onClick={() => setSelectedKeyword(kw)}
                  />
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-6">
          <TalentTree
            key={selectedKeyword}
            allTalents={allTalentsForKeyword}
            unlockedIds={unlockedIds}
            allocatableIds={allocatableIds}
            hasUnspentPoints={progress.unspentPoints > 0}
            onUnlock={handleUnlockTalent}
            onUnlockBegin={handleUnlockTalentBegin}
          />
        </div>
      </ScreenShell>

      {showResetConfirm ? (
        <ConfirmationDialog
          title="Reset Talents?"
          description="This will refund all your talent points so you can choose again. Any unspent talent points will also be available."
          confirmLabel="Reset Talents"
          tone="default"
          dimBackground={false}
          onConfirm={handleReset}
          onCancel={() => setShowResetConfirm(false)}
        />
      ) : null}
    </PageLayout>
  );
}
