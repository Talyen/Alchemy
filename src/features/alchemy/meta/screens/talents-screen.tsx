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
  keywordDefinitions,
  type UnlockedTalents,
  type TalentXP,
} from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { TalentOverviewGrid } from "../talents/talent-overview-grid";
import {
  ConfirmationDialog,
  HamburgerTrigger,
  PageLayout,
  ScreenHeaderRow,
  ScreenShell,
} from "../../shared/ui/shared-ui";
import { BUTTON_WIDTH_DIALOG } from "../../shared/config";
import { FadeSlot } from "../../shared/ui/fade-slot";
import { playUISound } from "@/lib/audio";
import { TalentTree } from "../talents/talent-tree";

// 4×10.5rem talent rows + 3×1rem tree gaps + 1rem pane gap + 4rem Back (h-16).
// Shared by overview and node so FadeSlot identity swaps do not change shell height
// (PageLayout centers the shell; a taller node pane would shift the whole screen up).
const TALENT_PANE_CLASS = "flex min-h-[50rem] w-full flex-col items-center";

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
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordId | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const keywordIds = useMemo(() => getTalentTreeKeywordIds(), []);

  const selectedKeywordDef = selectedKeyword ? keywordDefinitions[selectedKeyword] : undefined;
  const unlockedIds = useMemo(
    () => (selectedKeyword ? (unlockedTalents[selectedKeyword] ?? []) : []),
    [selectedKeyword, unlockedTalents],
  );
  const allTalentsForKeyword = useMemo(
    () => (selectedKeyword ? getTalentsForKeyword(selectedKeyword) : []),
    [selectedKeyword],
  );
  const allocatableIds = useMemo(
    () =>
      selectedKeyword
        ? new Set(getAllocatableTalentChoices(selectedKeyword, unlockedIds).map((t) => t.id))
        : new Set<string>(),
    [selectedKeyword, unlockedIds],
  );
  const progress = useMemo(() => {
    if (!selectedKeyword) return null;
    return getTalentKeywordProgress(
      talentXP[selectedKeyword] ?? 0,
      unlockedIds.length,
      countImplementedTalents(selectedKeyword),
    );
  }, [selectedKeyword, talentXP, unlockedIds.length]);

  function handleUnlockTalent(talentId: string) {
    if (selectedKeyword) {
      onUnlockTalent(selectedKeyword, talentId);
    }
  }

  function handleUnlockTalentBegin() {
    playUISound("talentUnlock");
  }

  function handleReset() {
    onResetTalents();
    setResetKey((k) => k + 1);
    setShowResetConfirm(false);
  }

  const title = selectedKeywordDef ? selectedKeywordDef.label : "Talents";

  return (
    <PageLayout align="center">
      <ScreenShell maxWidthClass="max-w-[90rem]" minHeightClass="min-h-[76cqh]" className="flex flex-col">
        <ScreenHeaderRow
          title={title}
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

        <FadeSlot swapKey={selectedKeyword ?? "overview"} className="mt-4 flex w-full flex-1 flex-col justify-center">
          {selectedKeyword === null ? (
            <div className={TALENT_PANE_CLASS}>
              <TalentOverviewGrid
                keywordIds={keywordIds}
                talentXP={talentXP}
                unlockedTalents={unlockedTalents}
                onSelectKeyword={setSelectedKeyword}
              />
            </div>
          ) : (
            <div className={cn(TALENT_PANE_CLASS, "gap-4")}>
              <TalentTree
                key={`${selectedKeyword}-${resetKey}`}
                allTalents={allTalentsForKeyword}
                unlockedIds={unlockedIds}
                allocatableIds={allocatableIds}
                hasUnspentPoints={(progress?.unspentPoints ?? 0) > 0}
                onUnlock={handleUnlockTalent}
                onUnlockBegin={handleUnlockTalentBegin}
              />
              <Button
                size="lg"
                variant="outline"
                className={BUTTON_WIDTH_DIALOG}
                onClick={() => setSelectedKeyword(null)}
              >
                Back
              </Button>
            </div>
          )}
        </FadeSlot>
      </ScreenShell>

      <ConfirmationDialog
        open={showResetConfirm}
        title="Reset Talents?"
        description="This will refund all your talent points so you can choose again. Any unspent talent points will also be available."
        confirmLabel="Reset Talents"
        tone="default"
        dimBackground={false}
        onConfirm={handleReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </PageLayout>
  );
}
