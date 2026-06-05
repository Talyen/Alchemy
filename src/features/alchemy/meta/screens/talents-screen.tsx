// Talent tree screen — spend XP to unlock keyword-specific talents.
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { keywordDefinitions, talentBackgroundArt, type KeywordId, getTalentsForKeyword } from "@/lib/game-data";
import { getTalentKeywordProgress } from "@/lib/talents";

import { TalentKeywordButton } from "../talents/talents-ui";
import { ConfirmationDialog, HamburgerTrigger, PageLayout, ScreenHeader } from "../../shared/ui/shared-ui";
import { useTalentChoices } from "../talents/use-talent-choices";
import { playUISound } from "@/lib/audio";
import { TalentTree } from "../talents/talent-tree";
import type { UnlockedTalents } from "@/lib/game-data";
import type { TalentXP } from "@/lib/talents";

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
  const keywordIds = useMemo(
    () => (Object.keys(keywordDefinitions) as KeywordId[]).filter((kw) => !keywordDefinitions[kw].hidden),
    [],
  );

  const unlockedIds = useMemo(() => unlockedTalents[selectedKeyword] ?? [], [selectedKeyword, unlockedTalents]);
  const allTalentsForKeyword = getTalentsForKeyword(selectedKeyword);
  const progress = getTalentKeywordProgress(
    talentXP[selectedKeyword] ?? 0,
    unlockedIds.length,
    allTalentsForKeyword.length,
  );
  const allUnlocked = progress.spentPoints >= allTalentsForKeyword.length;
  const unlockedTalentsForKeyword = useMemo(
    () => allTalentsForKeyword.filter((t) => unlockedIds.includes(t.id)),
    [allTalentsForKeyword, unlockedIds],
  );

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
      <div className="alchemy-shell flex min-h-[48.15cqh] w-full max-w-5xl flex-col rounded-shell-screen p-7">
        <div className="relative flex w-full items-center justify-center">
          <ScreenHeader title="Talents" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <HamburgerTrigger onClick={onOpenMenu} label="Open talents menu" />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
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
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={() => setShowResetConfirm(true)}
            aria-label="Reset talents"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="relative mt-6 aspect-[4/3]">
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
                className={cn(
                  "absolute inset-0 overflow-hidden transition-opacity duration-300 ease-in-out",
                  isSelected ? "opacity-100" : "opacity-0 pointer-events-none",
                )}
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
