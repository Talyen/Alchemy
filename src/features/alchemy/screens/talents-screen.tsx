// Talent tree screen — spend XP to unlock keyword-specific talents.
import { useState, useMemo } from "react";
import { House, Swords } from "lucide-react";

import { Button } from "@/components/ui/button";
import { keywordDefinitions, type KeywordId } from "@/lib/game-data";
import { getTalentKeywordProgress } from "@/lib/talents";

import { TalentKeywordButton } from "../talents/talents-ui";
import { ConfirmationDialog, PageLayout, ProgressBar, ScreenHeader } from "../ui/shared-ui";
import { KeywordTag } from "../ui/keyword-tag";
import { getTalentsForKeyword } from "@/lib/game-data";
import { useTalentChoices } from "../talents/use-talent-choices";
import { playUISound } from "@/lib/audio";
import { TalentTree } from "../talents/talent-tree";
import { useRunStore } from "../stores/run-store";
import { useBattleStore } from "../stores/battle-store";

export function TalentsScreen({
  onMainMenu,
  onReturnToBattle,
  onUnlockTalent,
  onResetTalents,
}: {
  onMainMenu: () => void;
  onReturnToBattle: () => void;
  onUnlockTalent: (keywordId: KeywordId, talentId: string) => void;
  onResetTalents: () => void;
}) {
  const hasActiveBattle = useBattleStore((s) => s.hasActiveBattle);
  const talentXP = useRunStore((s) => s.talentXP);
  const unlockedTalents = useRunStore((s) => s.unlockedTalents);
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordId>("physical");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const keywordIds = (Object.keys(keywordDefinitions) as KeywordId[]).filter((kw) => !keywordDefinitions[kw].hidden);

  const unlockedIds = useMemo(() => unlockedTalents[selectedKeyword] ?? [], [selectedKeyword, unlockedTalents]);
  const progress = getTalentKeywordProgress(talentXP[selectedKeyword] ?? 0, unlockedIds.length);
  const allTalentsForKeyword = getTalentsForKeyword(selectedKeyword);
  const allUnlocked = progress.spentPoints >= allTalentsForKeyword.length;
  const unlockedTalentsForKeyword = allTalentsForKeyword.filter((t) => unlockedIds.includes(t.id));

  const { currentChoices, invalidateKeyword, invalidateAll } = useTalentChoices(
    selectedKeyword,
    unlockedIds,
    progress.unspentPoints > 0,
    allUnlocked,
  );

  function handleUnlockTalent(talentId: string) {
    onUnlockTalent(selectedKeyword, talentId);
    invalidateKeyword(selectedKeyword);
    playUISound("talentUnlock");
  }
  function handleReset() {
    onResetTalents();
    invalidateAll();
    setShowResetConfirm(false);
  }

  return (
    <PageLayout>
      <div className="alchemy-shell flex min-h-[520px] w-full max-w-4xl flex-col rounded-[28px] px-6 py-7 sm:px-8">
        <ScreenHeader title="Talents" />

        <div className="mx-auto mt-6 flex w-full max-w-[760px] flex-col gap-6 text-left">
          <div className="flex flex-wrap justify-center gap-2">
            {keywordIds.map((kw) => {
              const kwProgress = getTalentKeywordProgress(talentXP[kw] ?? 0, (unlockedTalents[kw] ?? []).length);
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
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="rounded-full border border-border/40 px-3 py-1.5 text-xs font-medium text-muted-foreground/60 hover:border-border/60 hover:text-muted-foreground transition-transform active:scale-95"
            >
              Reset Talents
            </button>
          </div>

          <div>
            <div className="surface-muted rounded-[22px] border border-border/70 p-3">
              <div className="flex items-end justify-between">
                <span className="text-lg font-semibold text-foreground">
                  <KeywordTag keywordId={selectedKeyword} className="text-base" />
                </span>
                <span className="text-xs text-muted-foreground">
                  {progress.xpForNext - progress.xpRemaining} / {progress.xpForNext} XP
                </span>
              </div>
              <ProgressBar
                value={progress.progressPercent}
                className="mt-1.5"
                color="bg-primary"
                style={{
                  transition: "width 0.3s ease",
                  backgroundColor: keywordDefinitions[selectedKeyword]?.shineColors?.[0] ?? undefined,
                }}
              />
            </div>

            <div className="mt-4 min-h-[524px] min-w-[708px] px-0">
              <TalentTree
                unlockedTalents={unlockedTalentsForKeyword}
                allTalents={allTalentsForKeyword}
                choices={currentChoices}
                onUnlock={handleUnlockTalent}
              />
            </div>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap justify-center gap-3 pt-6">
          <Button variant="outline" onClick={onMainMenu}>
            <House className="h-4 w-4" /> Main Menu
          </Button>
          {hasActiveBattle ? (
            <Button onClick={onReturnToBattle}>
              <Swords className="h-4 w-4" /> Return to Battle
            </Button>
          ) : null}
        </div>
      </div>

      {showResetConfirm ? (
        <ConfirmationDialog
          title="Reset Talents?"
          description="This will refund all your talent points so you can choose again. Any unspent talent points will also be available."
          confirmLabel="Reset Talents"
          tone="default"
          onConfirm={handleReset}
          onCancel={() => setShowResetConfirm(false)}
        />
      ) : null}
    </PageLayout>
  );
}
