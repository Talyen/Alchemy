import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

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
import { ConfirmationDialog } from "../../shared/ui/dialogs";
import { TitledScreenShell } from "../../shared/ui/layout-components";
import { ChromeIconButton } from "../../shared/ui/chrome-icon-button";
import { usePlasmaInteraction } from "../../shared/ui/use-plasma-source";
import { getPlasmaColorPair, getPlasmaKeywordsForTalent } from "../../shared/config";
import { FadeSlot } from "../../shared/ui/use-fade";
import { playUISound } from "@/lib/audio";
import { TalentTree } from "../talents/talent-tree";

const TALENT_PANE_CLASS = "flex min-h-[calc(52*var(--content-rem,1rem))] w-full flex-col items-center";
const TALENT_PANE_TOP_PAD_CLASS = "pt-6 sm:pt-8";

export function TalentsScreen({
  talentXP,
  unlockedTalents,
  onUnlockTalent,
  onResetTalents,
  onBack,
  onMenu,
}: {
  talentXP: TalentXP;
  unlockedTalents: UnlockedTalents;
  onUnlockTalent: (keywordId: KeywordId, talentId: string) => void;
  onResetTalents: () => void;
  onBack?: (() => void) | undefined;
  onMenu?: ((rect: DOMRect) => void) | undefined;
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
  const unspentPoints = progress?.unspentPoints ?? 0;

  const handleBack = () => {
    if (selectedKeyword !== null) {
      setHoveredTalent(null);
      setSelectedKeyword(null);
    } else {
      onBack?.();
    }
  };

  return (
    <TitledScreenShell
      title={title}
      maxWidthClass="max-w-[calc(90*var(--content-rem,1rem))]"
      minHeightClass="min-h-[76cqh]"
      onBack={selectedKeyword ? handleBack : onBack}
      onMenu={onMenu}
      headerActions={
        <ChromeIconButton
          disabled={!hasAllocatedTalents}
          onClick={() => setShowResetConfirm(true)}
          aria-label="Reset talents"
        >
          <RotateCcw className="h-6 w-6" />
        </ChromeIconButton>
      }
    >
      <FadeSlot swapKey={selectedKeyword ?? "overview"} className="mt-4 flex w-full flex-1 flex-col justify-center">
        {selectedKeyword === null ? (
          <div className={cn(TALENT_PANE_CLASS, TALENT_PANE_TOP_PAD_CLASS)}>
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
          <div className={cn(TALENT_PANE_CLASS, TALENT_PANE_TOP_PAD_CLASS)}>
            <TalentTree
              key={selectedKeyword}
              allTalents={allTalentsForKeyword}
              unlockedIds={unlockedIds}
              allocatableIds={allocatableIds}
              hasUnspentPoints={unspentPoints > 0}
              onUnlock={handleUnlockTalent}
              onUnlockBegin={handleUnlockTalentBegin}
              onHoverTalent={setHoveredTalent}
            />
            <div className="mt-6 flex min-h-7 items-start justify-center">
              {unspentPoints > 0 ? (
                <p
                  aria-live="polite"
                  className="text-center font-sans text-xl font-normal tracking-normal text-balance text-muted-foreground/60"
                >
                  {unspentPoints} {unspentPoints === 1 ? "Talent Point" : "Talent Points"} Remaining
                </p>
              ) : null}
            </div>
          </div>
        )}
      </FadeSlot>

      <ConfirmationDialog
        open={showResetConfirm}
        title="Reset Talents"
        description="This will refund all your talent points."
        confirmLabel="Reset"
        tone="default"
        dimBackground={false}
        onConfirm={handleReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </TitledScreenShell>
  );
}
