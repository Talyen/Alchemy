// Talent tree screen — spend XP to unlock keyword-specific talents.
import { useState, useRef, useMemo } from "react";
import { House, Swords } from "lucide-react";

import { Button } from "@/components/ui/button";
import { keywordDefinitions, type KeywordId } from "@/lib/game-data";
import { computeTalentPoints, xpForNextPoint, xpToNextPoint, type TalentXP } from "@/lib/talents";
import { TALENT_CHOICES_OFFERED } from "@/lib/game-constants";

import { TalentKeywordButton } from "../ui/talents-ui";
import { ConfirmationDialog, PageLayout, ProgressBar, ScreenHeader } from "../ui/shared-ui";
import { KeywordTag } from "../ui/keyword-tag";
import { getTalentsForKeyword, sampleTalentChoices, type UnlockedTalents, type TalentDefinition } from "../talent-pool";
import { playUISound } from "@/lib/audio";
import { TalentLayout } from "../ui/talent-layouts";

export function TalentsScreen({
  hasActiveBattle, onMainMenu, onReturnToBattle, talentXP, runTalentXP,
  unlockedTalents, onUnlockTalent, onResetTalents,
}: {
  hasActiveBattle: boolean; onMainMenu: () => void; onReturnToBattle: () => void;
  talentXP: TalentXP; runTalentXP?: TalentXP; unlockedTalents: UnlockedTalents;
  onUnlockTalent: (keywordId: KeywordId, talentId: string) => void; onResetTalents: () => void;
}) {
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordId>("physical");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const keywordIds = Object.keys(keywordDefinitions) as KeywordId[];
  // Choices are cached per keyword so rerenders or tab changes do not reroll talent offers
  // until the player unlocks/refunds something that changes availability.
  const choicesCache = useRef<Record<string, TalentDefinition[]>>({});

  const currentXP = talentXP[selectedKeyword] ?? 0;
  const runXP = runTalentXP?.[selectedKeyword] ?? 0;
  const totalXP = currentXP + runXP;
  const totalPoints = computeTalentPoints(totalXP);
  const nextXP = xpForNextPoint(totalPoints);
  const progress = xpToNextPoint(totalXP);
  const progressPercent = Math.min(100, Math.round(((nextXP - progress) / nextXP) * 100));

  const unlockedIds = useMemo(() => unlockedTalents[selectedKeyword] ?? [], [selectedKeyword, unlockedTalents]);
  const spentPoints = unlockedIds.length;
  const unspentPoints = Math.max(0, totalPoints - spentPoints);
  const allTalentsForKeyword = getTalentsForKeyword(selectedKeyword);
  const allUnlocked = spentPoints >= allTalentsForKeyword.length;
  const unlockedTalentsForKeyword = allTalentsForKeyword.filter((t) => unlockedIds.includes(t.id));

  const currentChoices = useMemo(() => {
    const cached = choicesCache.current[selectedKeyword];
    if (cached) return cached; // eslint-disable-line react-hooks/refs
    if (allUnlocked || unspentPoints <= 0) return null;
    const c = sampleTalentChoices(selectedKeyword, unlockedIds, TALENT_CHOICES_OFFERED);
    if (c.length > 0) choicesCache.current[selectedKeyword] = c; // eslint-disable-line react-hooks/refs
    return c.length > 0 ? c : null;
  }, [selectedKeyword, unlockedIds, unspentPoints, allUnlocked]);

  function handleUnlockTalent(talentId: string) { onUnlockTalent(selectedKeyword, talentId); delete choicesCache.current[selectedKeyword]; playUISound("talentUnlock"); }
  // Clearing cached choices forces the next offer to reflect the newly unlocked/refunded state.
  function handleReset() { onResetTalents(); choicesCache.current = {}; setShowResetConfirm(false); }

  return (
    <PageLayout>
      <div className="alchemy-shell flex min-h-[520px] w-full max-w-4xl flex-col rounded-[28px] px-6 py-7 sm:px-8">
        <ScreenHeader title="Talents" />

        <div className="mx-auto mt-6 flex w-full max-w-[760px] flex-col gap-6 text-left">
          <div className="flex flex-wrap justify-center gap-2">
            {keywordIds.map((kw) => {
              const kwXP = (talentXP[kw] ?? 0) + (runTalentXP?.[kw] ?? 0);
              const kwPoints = computeTalentPoints(kwXP);
              const kwUnlockedIds = unlockedTalents[kw] ?? [];
              const hasUnspent = kwPoints - kwUnlockedIds.length > 0;
              return <TalentKeywordButton key={kw} keywordId={kw} hasUnspent={hasUnspent} isSelected={selectedKeyword === kw} onClick={() => setSelectedKeyword(kw)} />;
            })}
            <button type="button" onClick={() => setShowResetConfirm(true)} className="rounded-full border border-border/40 px-3 py-1.5 text-xs font-medium text-muted-foreground/60 hover:border-border/60 hover:text-muted-foreground transition-transform active:scale-95">Reset Talents</button>
          </div>

            <div>
              <div className="surface-muted rounded-[22px] border border-border/70 p-3">
                <div className="flex items-end justify-between">
                  <span className="text-lg font-semibold text-foreground"><KeywordTag keywordId={selectedKeyword} className="text-base" /></span>
                  <span className="text-xs text-muted-foreground">{nextXP - progress} / {nextXP} XP</span>
                </div>
                <ProgressBar value={progressPercent} className="mt-1.5" color="bg-primary" style={{ transition: "width 0.3s ease", backgroundColor: keywordDefinitions[selectedKeyword]?.shineColors?.[0] ?? undefined }} />
              </div>

              <div className="mt-4 min-h-[524px] min-w-[708px] px-0">
                <TalentLayout unlockedTalents={unlockedTalentsForKeyword} allTalents={allTalentsForKeyword} choices={currentChoices} onUnlock={handleUnlockTalent} /> {/* eslint-disable-line react-hooks/refs */}
              </div>
            </div>
        </div>

        <div className="mt-auto flex flex-wrap justify-center gap-3 pt-6">
          <Button variant="outline" onClick={onMainMenu}><House className="h-4 w-4" /> Main Menu</Button>
          {hasActiveBattle ? <Button onClick={onReturnToBattle}><Swords className="h-4 w-4" /> Return to Battle</Button> : null}
        </div>
      </div>

      {showResetConfirm ? <ConfirmationDialog title="Reset Talents?" description="This will refund all your talent points so you can choose again. Any unspent talent points will also be available." confirmLabel="Reset Talents" tone="default" onConfirm={handleReset} onCancel={() => setShowResetConfirm(false)} /> : null}
    </PageLayout>
  );
}
