import { useGameTranslation } from "@/components/use-game-translation";
import { text as gameText } from "@/lib/localization/runtime";
import { useId, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  bodyTextClass,
  DEATHS_DOOR_PLASMA_PAIR,
  getPlasmaColorPair,
  getPlasmaKeywordsForCharacter,
} from "@/features/alchemy/shared/config";
import { getTalentTreeKeywordIds, type CharacterId, type KeywordId, type TalentXP } from "@/lib/game-data";
import { CRAFTING_CURRENCY_LIST, type CraftingCurrencyId } from "@/lib/gear";
import type { RunObtainedItem, RunRecap } from "@/lib/active-run-session";
import type { MaterialInventory } from "@/lib/homestead/types";
import { cn } from "@/lib/utils";
import { TitledScreenShell } from "../../shared/ui/layout-components";
import { CurrencyChip } from "../../shared/ui/currency-chip";
import { usePlasmaBaseline } from "../../shared/ui/use-plasma-source";
import { FoundResourcesRow } from "../../shared/ui/found-resources-row";
import { KeywordProgressGrid } from "./keyword-progress-grid";
import { RunEndObtainedItems } from "./run-end-obtained-items";

import { BattleBoonInspectButton, BattleBoonInspectOverlay } from "./battle-screen/boon-inspect";
import { hasInspectableBoons } from "./battle-screen/unique-run-boons";

const COLLAPSED_TALENT_COUNT = 10;

export function RunEndScreen({
  runRecap,
  title,
  subtitle,
  outcome,
  characterId,
  runEndTalentXP,
  talentXP,
  runEndMaterials,
  runEndCurrencies,
  runEndItems,
  onContinue,
  continueLabel = gameText("ui.run-end-screen.default-continueLabel", "Main Menu"),
}: {
  runRecap: RunRecap | null;
  title: string;
  subtitle: string;
  outcome: "victory" | "defeat";
  characterId: CharacterId;
  runEndTalentXP: TalentXP;
  talentXP: TalentXP;
  runEndMaterials: MaterialInventory;
  runEndCurrencies: Record<CraftingCurrencyId, number>;
  runEndItems: readonly RunObtainedItem[];
  onContinue: () => void;
  continueLabel?: string;
}) {
  const i18n = useGameTranslation();
  const [boonsOpen, setBoonsOpen] = useState(false);
  const [talentsExpanded, setTalentsExpanded] = useState(false);
  const talentGridId = useId();
  const plasmaColorPair =
    outcome === "defeat" ? DEATHS_DOOR_PLASMA_PAIR : getPlasmaColorPair(getPlasmaKeywordsForCharacter(characterId));
  usePlasmaBaseline(plasmaColorPair);
  const visibleKeywords = useMemo(() => new Set(getTalentTreeKeywordIds()), []);
  const entries = useMemo(
    () =>
      (Object.keys(runEndTalentXP) as KeywordId[])
        .filter((kw) => visibleKeywords.has(kw) && (runEndTalentXP[kw] ?? 0) > 0)
        .sort((a, b) => (runEndTalentXP[b] ?? 0) - (runEndTalentXP[a] ?? 0))
        .map((kw) => ({ kw, totalXP: talentXP[kw] ?? 0 })),
    [runEndTalentXP, talentXP, visibleKeywords],
  );
  const earnedCurrencies = useMemo(
    () => CRAFTING_CURRENCY_LIST.filter((currency) => (runEndCurrencies[currency.id] ?? 0) > 0),
    [runEndCurrencies],
  );

  return (
    <TitledScreenShell
      title={title}
      maxWidthClass="max-w-7xl"
      leading={
        runRecap && hasInspectableBoons(runRecap.boons) ? (
          <BattleBoonInspectButton open={boonsOpen} onToggle={() => setBoonsOpen((open) => !open)} />
        ) : undefined
      }
    >
      <div className="mt-6 flex flex-col items-center gap-8 text-center">
        {subtitle ? <p className={cn(bodyTextClass, "text-xl")}>{subtitle}</p> : null}

        {entries.length > 0 ? (
          <div className="flex w-full flex-col items-center gap-2">
            <div id={talentGridId} className="w-full">
              <KeywordProgressGrid
                entries={talentsExpanded ? entries : entries.slice(0, COLLAPSED_TALENT_COUNT)}
                size="lg"
              />
            </div>
            {entries.length > COLLAPSED_TALENT_COUNT ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-pale"
                aria-label={i18n.displayText(
                  talentsExpanded
                    ? i18n.text("ui.run-end-screen.d1", "Show fewer Talent XP")
                    : i18n.text("ui.run-end-screen.d2", "Show all Talent XP"),
                )}
                aria-expanded={talentsExpanded}
                aria-controls={talentGridId}
                onClick={() => setTalentsExpanded((expanded) => !expanded)}
              >
                {talentsExpanded ? (
                  <ChevronUp className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-5 w-5" aria-hidden="true" />
                )}
              </Button>
            ) : null}
          </div>
        ) : null}
        <RunEndObtainedItems items={runEndItems} />
        <FoundResourcesRow gold={runRecap?.gold ?? 0} materials={runEndMaterials} size="lg" />
        {earnedCurrencies.length > 0 ? (
          <div className="flex flex-wrap items-center justify-center gap-3">
            {earnedCurrencies.map((currency) => (
              <CurrencyChip
                key={currency.id}
                currency={currency}
                count={runEndCurrencies[currency.id] ?? 0}
                testId="run-end-currency"
              />
            ))}
          </div>
        ) : null}

        <Button size="lg" variant="primary" className="min-w-56" onClick={onContinue}>
          {continueLabel}
        </Button>
      </div>
      <BattleBoonInspectOverlay
        open={boonsOpen}
        trinketIds={runRecap?.boons ?? []}
        onClose={() => setBoonsOpen(false)}
      />
    </TitledScreenShell>
  );
}
