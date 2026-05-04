// Talent tree screen — spend XP to unlock keyword-specific talents.
import { useState, useRef, useMemo } from "react";
import { House, Swords } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { keywordDefinitions, type KeywordId } from "@/lib/game-data";
import { computeTalentPoints, xpForNextPoint, xpToNextPoint, type TalentXP } from "@/lib/talents";
import { TALENT_CHOICES_OFFERED } from "@/lib/game-constants";

import { TalentChoicesInline, TalentKeywordButton, TalentList } from "../ui/talents-ui";
import { ConfirmationDialog, PageLayout, ProgressBar } from "../ui/shared-ui";
import { KeywordTag } from "../ui/keyword-tag";
import { getTalentsForKeyword, sampleTalentChoices, type UnlockedTalents, type TalentDefinition } from "../talent-pool";

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
  const choicesCache = useRef<Record<string, TalentDefinition[]>>({});

  const currentXP = talentXP[selectedKeyword] ?? 0;
  const runXP = runTalentXP?.[selectedKeyword] ?? 0;
  const totalXP = currentXP + runXP;
  const totalPoints = computeTalentPoints(totalXP);
  const nextXP = xpForNextPoint(totalPoints);
  const progress = xpToNextPoint(totalXP);
  const progressPercent = Math.min(100, Math.round(((nextXP - progress) / nextXP) * 100));

  const unlockedIds = unlockedTalents[selectedKeyword] ?? [];
  const spentPoints = unlockedIds.length;
  const unspentPoints = Math.max(0, totalPoints - spentPoints);
  const allTalentsForKeyword = getTalentsForKeyword(selectedKeyword);
  const allUnlocked = spentPoints >= allTalentsForKeyword.length;
  const unlockedTalentsForKeyword = allTalentsForKeyword.filter((t) => unlockedIds.includes(t.id));

  const currentChoices = useMemo(() => {
    const cached = choicesCache.current[selectedKeyword];
    if (cached) return cached;
    if (allUnlocked || unspentPoints <= 0) return null;
    const c = sampleTalentChoices(selectedKeyword, unlockedIds, TALENT_CHOICES_OFFERED);
    if (c.length > 0) choicesCache.current[selectedKeyword] = c;
    return c.length > 0 ? c : null;
  }, [selectedKeyword, unlockedIds, unspentPoints, allUnlocked]);

  function handleChooseTalent(talent: TalentDefinition) { onUnlockTalent(selectedKeyword, talent.id); delete choicesCache.current[selectedKeyword]; }
  function handleReset() { onResetTalents(); choicesCache.current = {}; setShowResetConfirm(false); }

  return (
    <PageLayout>
      <div className="alchemy-shell flex w-full max-w-3xl flex-col rounded-[28px] px-6 py-7 sm:px-8">
        <h1 className="text-center text-3xl font-semibold text-foreground">Talents</h1>

        <div className="mx-auto mt-6 flex w-full max-w-2xl flex-col gap-6 text-left">
          <div className="flex flex-wrap justify-center gap-2">
            {keywordIds.map((kw) => {
              const kwXP = (talentXP[kw] ?? 0) + (runTalentXP?.[kw] ?? 0);
              const kwPoints = computeTalentPoints(kwXP);
              const kwUnlockedIds = unlockedTalents[kw] ?? [];
              const hasUnspent = kwPoints - kwUnlockedIds.length > 0;
              return <TalentKeywordButton key={kw} keywordId={kw} hasUnspent={hasUnspent} isSelected={selectedKeyword === kw} onClick={() => setSelectedKeyword(kw)} />;
            })}
            <button type="button" onClick={() => setShowResetConfirm(true)} className="rounded-full border border-border/40 px-3 py-1.5 text-xs font-medium text-muted-foreground/60 hover:border-border/60 hover:text-muted-foreground">Reset Talents</button>
          </div>

          <div className="surface-muted rounded-[22px] border border-border/70 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground"><KeywordTag keywordId={selectedKeyword} /> XP Progress</p>
              <p className="text-xs text-muted-foreground">{totalXP} XP / {nextXP} XP — {totalPoints} point{totalPoints !== 1 ? "s" : ""}</p>
            </div>
            <ProgressBar value={progressPercent} className="mt-3" style={{ transition: "width 0.3s ease" }} />
          </div>

          {currentChoices ? <TalentChoicesInline choices={currentChoices} onChoose={handleChooseTalent} /> : <TalentList unlockedTalents={unlockedTalentsForKeyword} allTalents={allTalentsForKeyword} />}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="outline" onClick={onMainMenu}><House className="h-4 w-4" /> Main Menu</Button>
        {hasActiveBattle ? <Button onClick={onReturnToBattle}><Swords className="h-4 w-4" /> Return to Battle</Button> : null}
      </div>

      {showResetConfirm ? <ConfirmationDialog title="Reset Talents?" description="This will refund all your talent points so you can choose again. Any unspent talent points will also be available." confirmLabel="Reset Talents" tone="default" onConfirm={handleReset} onCancel={() => setShowResetConfirm(false)} /> : null}
    </PageLayout>
  );
}
