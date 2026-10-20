import { useGameTranslation } from "@/components/use-game-translation";

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
import { cn } from "@/lib/utils";
import { playUISound } from "@/lib/audio";
import { TalentTree } from "../talents/talent-tree";
import { useCaptureEscapeCancel } from "../../shared/ui/use-modal-escape-dismiss";

const TALENT_PANE_CLASS = "col-start-1 row-start-1 flex w-full flex-col items-center";

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
  const i18n = useGameTranslation();
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
  // Keep both panes in the grid so its height cannot change during navigation.
  const treeKeyword = selectedKeyword ?? "block";
  const unlockedIds = unlockedTalents[treeKeyword] ?? [];
  const allTalentsForKeyword = getTalentsForKeyword(treeKeyword);
  const allocatableIds = new Set(getAllocatableTalentChoices(treeKeyword, unlockedIds).map((talent) => talent.id));
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
  useCaptureEscapeCancel(selectedKeyword !== null ? handleBack : undefined);

  return (
    <TitledScreenShell
      title={i18n.displayText(title)}
      maxWidthClass="max-w-[calc(90*var(--content-rem,1rem))]"
      onBack={selectedKeyword ? handleBack : onBack}
      onMenu={onMenu}
      headerActions={
        <ChromeIconButton
          disabled={!hasAllocatedTalents}
          onClick={() => setShowResetConfirm(true)}
          aria-label={i18n.text("ui.talents-screen.1", "Reset talents")}
        >
          <RotateCcw />
        </ChromeIconButton>
      }
    >
      <FadeSlot swapKey={selectedKeyword ?? "overview"} className="mt-4 grid w-full items-start">
        <div
          className={cn(TALENT_PANE_CLASS, selectedKeyword !== null && "invisible")}
          aria-hidden={selectedKeyword !== null}
          inert={selectedKeyword !== null}
        >
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
        <div
          className={cn(TALENT_PANE_CLASS, selectedKeyword === null && "invisible")}
          aria-hidden={selectedKeyword === null}
          inert={selectedKeyword === null}
        >
          <TalentTree
            key={treeKeyword}
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
                {i18n.text("talents.remaining", "{{count}} Talent Points Remaining", {
                  count: i18n.displayText(unspentPoints),
                })}
              </p>
            ) : null}
          </div>
        </div>
      </FadeSlot>

      <ConfirmationDialog
        open={showResetConfirm}
        title={i18n.text("ui.talents-screen.3", "Reset Talents")}
        description={i18n.text("ui.talents-screen.4", "This will refund all your talent points.")}
        confirmLabel={i18n.text("ui.talents-screen.5", "Reset")}
        tone="default"
        dimBackground={false}
        onConfirm={handleReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </TitledScreenShell>
  );
}
