import { useGameTranslation } from "@/components/use-game-translation";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { type BattleCard, type TalentXP, type TrinketEntry } from "@/lib/game-data";
import { type MaterialId } from "@/lib/homestead/types";
import { cn } from "@/lib/utils";

import { FoundResourcesRow } from "../../../shared/ui/found-resources-row";
import { bodyTextClass, controlLabelClass } from "@/features/alchemy/shared/config";
import type { MysteryChoice, MysteryEffect } from "@/lib/mystery";
import type { GearInstance } from "@/lib/gear";
import { MysteryEffectBadge } from "./mystery-effect-badge";
import { KeywordProgressGrid } from "../keyword-progress-grid";
import { MysteryCardRewardItem, MysteryEquipmentRewardItem } from "./mystery-reward-artwork";
import { pairMysteryEffectsWithGrants } from "./mystery-choice-utils";

interface LookupProps {
  findCard: (id: string) => BattleCard | undefined;
  findTrinket: (id: string) => TrinketEntry | undefined;
}

function MysteryRewardEffectItem({
  effect,
  findCard,
  findTrinket,
  grantedGear,
  chosenCardId,
}: {
  effect: MysteryEffect;
  grantedGear: GearInstance | undefined;
  chosenCardId: string | null;
} & LookupProps) {
  const i18n = useGameTranslation();
  switch (effect.kind) {
    case "addCard": {
      const card = findCard(effect.cardId);
      return card ? <MysteryCardRewardItem card={card} /> : null;
    }
    case "chooseCard": {
      const card = chosenCardId ? findCard(chosenCardId) : undefined;
      return card ? <MysteryCardRewardItem card={card} /> : null;
    }
    case "gainTrinket": {
      const boon = findTrinket(effect.trinketId);
      return boon ? <MysteryEquipmentRewardItem item={boon} /> : null;
    }
    case "gainGeneratedGear":
    case "gainRandomGear": {
      const fallbackLabel =
        effect.kind === "gainGeneratedGear" ? "Added Gear to your Armory" : "Added random Gear to your Armory";
      if (!grantedGear)
        return <p className={cn(controlLabelClass, "text-balance")}>{i18n.displayText(fallbackLabel)}</p>;
      return <MysteryEquipmentRewardItem item={grantedGear} />;
    }
    case "gainGold":
    case "gainMaterial":
    case "gainXP":
      return null;
    case "healHealth":
      return (
        <p className={bodyTextClass}>
          <MysteryEffectBadge effect={effect} findCard={findCard} findTrinket={findTrinket} />
        </p>
      );
  }
}

export function MysteryRewardSummary({
  choice,
  findCard,
  findTrinket,
  grantedGearInstances,
  chosenCardId,
  runTalentXP = {},
  talentXP = {},
  onContinue,
}: {
  choice: MysteryChoice;
  grantedGearInstances: GearInstance[];
  chosenCardId: string | null;
  runTalentXP?: TalentXP;
  talentXP?: TalentXP;
  onContinue: () => void;
} & LookupProps) {
  const i18n = useGameTranslation();
  const xpGains = new Map<Extract<MysteryEffect, { kind: "gainXP" }>["keyword"], number>();
  let totalGold = 0;
  let hasResources = false;
  const mats: Partial<Record<MaterialId, number>> = {};
  for (const effect of choice.effects) {
    if (effect.kind === "gainXP") {
      xpGains.set(effect.keyword, (xpGains.get(effect.keyword) ?? 0) + effect.amount);
    }
    if (effect.kind === "gainGold") totalGold += effect.amount;
    if (effect.kind === "gainMaterial") mats[effect.material] = (mats[effect.material] ?? 0) + effect.amount;
    if (effect.kind === "gainGold" || effect.kind === "gainMaterial") hasResources = true;
  }

  const resolvedOtherEffects = useMemo(() => {
    const others = choice.effects.filter(
      (e) => e.kind !== "gainGold" && e.kind !== "gainMaterial" && e.kind !== "gainXP",
    );
    return pairMysteryEffectsWithGrants(others, grantedGearInstances);
  }, [choice.effects, grantedGearInstances]);

  return (
    <div className="flex w-full flex-col items-center gap-6 text-center">
      <KeywordProgressGrid
        entries={[...xpGains].map(([kw]) => ({
          kw,
          totalXP: (talentXP[kw] ?? 0) + (runTalentXP[kw] ?? 0),
        }))}
        size="lg"
      />

      {resolvedOtherEffects.map(({ effect, grantedGear }, i) => (
        <div key={`${effect.kind}-${i}`}>
          <MysteryRewardEffectItem
            effect={effect}
            findCard={findCard}
            findTrinket={findTrinket}
            grantedGear={grantedGear}
            chosenCardId={chosenCardId}
          />
        </div>
      ))}

      {hasResources ? (
        <div className="w-full min-w-0">
          <FoundResourcesRow gold={totalGold} materials={mats} size="lg" />
        </div>
      ) : null}

      <div>
        <Button size="lg" className="min-w-56" onClick={onContinue}>
          {i18n.text("ui.mystery-reward-summary.3", "Continue")}
        </Button>
      </div>
    </div>
  );
}
