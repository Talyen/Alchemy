// Talent tree screen — spend XP to unlock keyword-specific talents.
import { useState, useMemo } from "react";
import { Menu, RotateCcw, Swords } from "lucide-react";

import { Button } from "@/components/ui/button";
import { keywordDefinitions, talentBackgroundArt, type KeywordId } from "@/lib/game-data";
import { getTalentKeywordProgress } from "@/lib/talents";

import { TalentKeywordButton } from "../talents/talents-ui";
import { ConfirmationDialog, PageLayout } from "../ui/shared-ui";

import { getTalentsForKeyword } from "@/lib/game-data";
import { useTalentChoices } from "../talents/use-talent-choices";
import { playUISound } from "@/lib/audio";
import { TalentTree } from "../talents/talent-tree";
import { useRunStore } from "../stores/run-store";
import { useBattleStore } from "../stores/battle-store";

export function TalentsScreen({
  onOpenMenu,
  onReturnToBattle,
  onUnlockTalent,
  onResetTalents,
}: {
  onOpenMenu: (rect?: DOMRect) => void;
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
  const allTalentsForKeyword = getTalentsForKeyword(selectedKeyword);
  const progress = getTalentKeywordProgress(
    talentXP[selectedKeyword] ?? 0,
    unlockedIds.length,
    allTalentsForKeyword.length,
  );
  const allUnlocked = progress.spentPoints >= allTalentsForKeyword.length;
  const unlockedTalentsForKeyword = allTalentsForKeyword.filter((t) => unlockedIds.includes(t.id));

  const { currentChoices } = useTalentChoices(selectedKeyword, unlockedIds, progress.unspentPoints > 0, allUnlocked);
  const MASK_ID = "talent-bg-mask";
  const BLUR_ID = "talent-bg-blur";

  function handleUnlockTalent(talentId: string) {
    onUnlockTalent(selectedKeyword, talentId);
    playUISound("talentUnlock");
  }
  function handleReset() {
    onResetTalents();
    setShowResetConfirm(false);
  }

  return (
    <PageLayout>
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center">
        <div className="relative flex w-full items-center justify-center">
          <h1 className="font-display text-lg font-black uppercase tracking-[0.15em] text-amber-100/75 sm:text-xl">
            Talents
          </h1>
          <div className="absolute right-0 flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => setShowResetConfirm(true)}
              aria-label="Reset talents"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={(e) => onOpenMenu(e.currentTarget.getBoundingClientRect())}
              aria-label="Open talents menu"
            >
              <Menu className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="mt-2 h-px w-44 bg-gradient-to-r from-transparent via-amber-100/75 to-transparent" />
      </div>

      <div className="mx-auto mt-6 w-full max-w-4xl flex flex-wrap justify-center gap-2">
        {keywordIds.map((kw) => {
          const kwProgress = getTalentKeywordProgress(
            talentXP[kw] ?? 0,
            (unlockedTalents[kw] ?? []).length,
            getTalentsForKeyword(kw).length,
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

      <div className="relative mx-auto mt-6 w-full max-w-4xl aspect-[4/3] origin-top scale-[1.1]">
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-0">
          <defs>
            <filter id={BLUR_ID}>
              <feGaussianBlur stdDeviation="24" />
            </filter>
            <mask id={MASK_ID} maskUnits="userSpaceOnUse">
              <rect x="7%" y="7%" width="86%" height="86%" rx="24" fill="white" filter={`url(#${BLUR_ID})`} />
            </mask>
          </defs>
        </svg>
        {Object.entries(talentBackgroundArt).map(([kw, art]) => {
          if (!art) return null;
          const isSelected = selectedKeyword === kw;
          return (
            <div
              key={kw}
              className={`absolute inset-0 overflow-hidden transition-opacity duration-300 ease-in-out ${
                isSelected ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              style={{
                backgroundImage: `url(${art})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "brightness(0.9)",
                maskImage: `url(#${MASK_ID})`,
                WebkitMaskImage: `url(#${MASK_ID})`,
              }}
            />
          );
        })}

        <div className="h-full w-full">
          <TalentTree
            keywordId={selectedKeyword}
            unlockedTalents={unlockedTalentsForKeyword}
            allTalents={allTalentsForKeyword}
            choices={currentChoices}
            onUnlock={handleUnlockTalent}
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {hasActiveBattle ? (
          <Button onClick={onReturnToBattle}>
            <Swords className="h-4 w-4" /> Return to Battle
          </Button>
        ) : null}
      </div>

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
