import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  bodyTextClass,
  DEATHS_DOOR_PLASMA_PAIR,
  getPlasmaColorPair,
  getPlasmaKeywordsForCharacter,
} from "@/features/alchemy/shared/config";
import { getTalentTreeKeywordIds, type CharacterId, type KeywordId, type TalentXP } from "@/lib/game-data";
import { CRAFTING_CURRENCY_LIST, type CraftingCurrencyId } from "@/lib/gear";
import type { RunObtainedItem } from "@/lib/active-run-session";
import type { MaterialInventory } from "@/lib/homestead/types";
import { cn } from "@/lib/utils";
import { TitledScreenShell } from "../../shared/ui/layout-components";
import { CurrencyChip } from "../../shared/ui/currency-chip";
import { usePlasmaBaseline } from "../../shared/ui/use-plasma-source";
import { FoundResourcesRow } from "../../shared/ui/found-resources-row";
import { KeywordProgressGrid } from "./keyword-progress-grid";
import { RunEndObtainedItems } from "./run-end-obtained-items";

export function RunEndScreen({
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
}: {
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
}) {
  const plasmaColorPair =
    outcome === "defeat" ? DEATHS_DOOR_PLASMA_PAIR : getPlasmaColorPair(getPlasmaKeywordsForCharacter(characterId));
  usePlasmaBaseline(plasmaColorPair);
  const visibleKeywords = useMemo(() => new Set(getTalentTreeKeywordIds()), []);
  const entries = useMemo(
    () =>
      (Object.keys(runEndTalentXP) as KeywordId[])
        .filter((kw) => visibleKeywords.has(kw) && (runEndTalentXP[kw] ?? 0) > 0)
        .map((kw) => ({ kw, totalXP: talentXP[kw] ?? 0 })),
    [runEndTalentXP, talentXP, visibleKeywords],
  );
  const earnedCurrencies = useMemo(
    () => CRAFTING_CURRENCY_LIST.filter((currency) => (runEndCurrencies[currency.id] ?? 0) > 0),
    [runEndCurrencies],
  );

  return (
    <TitledScreenShell title={title} maxWidthClass="max-w-7xl">
      <div className="mt-6 flex flex-col items-center gap-8 text-center">
        <p className={cn(bodyTextClass, "text-xl")}>{subtitle}</p>

        {entries.length > 0 ? <KeywordProgressGrid entries={entries} size="lg" /> : null}
        <RunEndObtainedItems items={runEndItems} />
        <FoundResourcesRow materials={runEndMaterials} size="lg" />
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
          Continue
        </Button>
      </div>
    </TitledScreenShell>
  );
}
