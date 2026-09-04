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
  type TalentDefinition,
  type UnlockedTalents,
  type TalentXP,
} from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { TalentOverviewGrid } from "../talents/talent-overview-grid";
import { ConfirmationDialog, TitledScreenShell } from "../../shared/ui/shared-ui";
import { usePlasmaInteraction } from "../../shared/ui/use-plasma-source";
import { BUTTON_WIDTH_DIALOG, getPlasmaColorPair, getPlasmaKeywordsForTalent } from "../../shared/config";
import { FadeSlot } from "../../shared/ui/fade-slot";
import { playUISound } from "@/lib/audio";
import { TalentTree } from "../talents/talent-tree";

const TALENT_PANE_CLASS = "flex min-h-[50rem] w-full flex-col items-center";

export function TalentsScreen({
  talentXP,
  unlockedTalents,
  onUnlockTalent,
  onResetTalents,
}: {
  talentXP: TalentXP;
  unlockedTalents: UnlockedTalents;
  onUnlockTalent: (keywordId: KeywordId, talentId: string) => void;
  onResetTalents: () => void;
}) {
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordId | null>(null);
  const [hoveredOverviewKeyword, setHoveredOverviewKeyword] = useState<KeywordId | null>(null);
  const [hoveredTalent, setHoveredTalent] = useState<TalentDefinition | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const keywordIds = useMemo(() => getTalentTreeKeywordIds(), []);
  const hasAllocatedTalents = Object.values(unlockedTalents).some((talents) => (talents?.length ?? 0) > 0);
  const unspentByKeyword = useMemo(() => {
    const map = new Map<KeywordId, boolean>();
    for (const keywordId of keywordIds) {
      map.set(
        keywordId,
        getTalentKeywordProgress(
          talentXP[keywordId] ?? 0,
          (unlockedTalents[keywordId] ?? []).length,
          countImplementedTalents(keywordId),
        ).hasUnspent,
      );
    }
    return map;
  }, [keywordIds, talentXP, unlockedTalents]);

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

  const plasmaKeywordIds = useMemo(() => {
    if (selectedKeyword === null) {
      return hoveredOverviewKeyword ? [hoveredOverviewKeyword] : null;
    }
    if (hoveredTalent) {
      return getPlasmaKeywordsForTalent(hoveredTalent);
    }
    return null;
  }, [hoveredOverviewKeyword, hoveredTalent, selectedKeyword]);
  usePlasmaInteraction(plasmaKeywordIds ? getPlasmaColorPair(plasmaKeywordIds) : null, plasmaKeywordIds !== null);

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
    setShowResetConfirm(false);
  }

  const title = selectedKeywordDef ? selectedKeywordDef.label : "Talents";

  return (
    <TitledScreenShell
      title={title}
      maxWidthClass="max-w-[90rem]"
      minHeightClass="min-h-[76cqh]"
      headerActions={
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 text-muted-foreground"
          disabled={!hasAllocatedTalents}
          onClick={() => setShowResetConfirm(true)}
          aria-label="Reset talents"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      }
    >
      <FadeSlot swapKey={selectedKeyword ?? "overview"} className="mt-4 flex w-full flex-1 flex-col justify-center">
        {selectedKeyword === null ? (
          <div className={TALENT_PANE_CLASS}>
            <TalentOverviewGrid
              keywordIds={keywordIds}
              unspentByKeyword={unspentByKeyword}
              onSelectKeyword={(kw) => {
                setHoveredOverviewKeyword(null);
                setSelectedKeyword(kw);
              }}
              onHoverKeyword={setHoveredOverviewKeyword}
            />
          </div>
        ) : (
          <div className={cn(TALENT_PANE_CLASS, "gap-4")}>
            <TalentTree
              key={selectedKeyword}
              allTalents={allTalentsForKeyword}
              unlockedIds={unlockedIds}
              allocatableIds={allocatableIds}
              hasUnspentPoints={(progress?.unspentPoints ?? 0) > 0}
              onUnlock={handleUnlockTalent}
              onUnlockBegin={handleUnlockTalentBegin}
              onHoverTalent={setHoveredTalent}
            />
            <Button
              size="lg"
              variant="outline"
              className={BUTTON_WIDTH_DIALOG}
              onClick={() => {
                setHoveredTalent(null);
                setSelectedKeyword(null);
              }}
            >
              Back
            </Button>
          </div>
        )}
      </FadeSlot>

      <ConfirmationDialog
        open={showResetConfirm}
        title="Reset Talents?"
        description="This will refund all your talent points so you can choose again."
        confirmLabel="Reset Talents"
        tone="default"
        dimBackground={false}
        onConfirm={handleReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </TitledScreenShell>
  );
}
