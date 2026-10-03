import { useState } from "react";
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

import { TalentOverviewGrid } from "../talents/talent-overview-grid";
import { ConfirmationDialog } from "../../shared/ui/dialogs";
import { TitledScreenShell } from "../../shared/ui/layout-components";
import { ChromeIconButton } from "../../shared/ui/chrome-icon-button";
import { usePlasmaInteraction } from "../../shared/ui/use-plasma-source";
import { getPlasmaColorPair, getPlasmaKeywordsForTalent } from "../../shared/config";
import { FadeSlot } from "../../shared/ui/use-fade";
import { playUISound } from "@/lib/audio";
import { TalentTree } from "../talents/talent-tree";

const TALENT_PANE_CLASS = "flex w-full flex-col items-center";

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
  const keywordIds = getTalentTreeKeywordIds();
  const hasAllocatedTalents = Object.values(unlockedTalents).some((talents) => (talents?.length ?? 0) > 0);
  const unspentByKeyword = new Map(
    keywordIds.map((keywordId) => [
      keywordId,
      getTalentKeywordProgress(
        talentXP[keywordId] ?? 0,
        (unlockedTalents[keywordId] ?? []).length,
        countImplementedTalents(keywordId),
      ).hasUnspent,
    ]),
  );
  const selectedKeywordDef = selectedKeyword ? keywordDefinitions[selectedKeyword] : undefined;
  const unlockedIds = selectedKeyword ? (unlockedTalents[selectedKeyword] ?? []) : [];
  const allTalentsForKeyword = selectedKeyword ? getTalentsForKeyword(selectedKeyword) : [];
  const allocatableIds = new Set(
    selectedKeyword ? getAllocatableTalentChoices(selectedKeyword, unlockedIds).map((talent) => talent.id) : [],
  );
  const progress = selectedKeyword
    ? getTalentKeywordProgress(
        talentXP[selectedKeyword] ?? 0,
        unlockedIds.length,
        countImplementedTalents(selectedKeyword),
      )
    : null;
  const plasmaKeywordIds =
    selectedKeyword === null
      ? hoveredOverviewKeyword
        ? [hoveredOverviewKeyword]
        : null
      : hoveredTalent
        ? getPlasmaKeywordsForTalent(hoveredTalent)
        : null;
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
      <FadeSlot swapKey={selectedKeyword ?? "overview"} className="mt-4 flex w-full flex-col">
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
          <div className={TALENT_PANE_CLASS}>
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
