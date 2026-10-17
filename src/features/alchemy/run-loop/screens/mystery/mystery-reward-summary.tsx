import { useGameTranslation } from "@/components/use-game-translation";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { type BattleCard, type TalentXP, type TrinketEntry } from "@/lib/game-data";
import { type MaterialId } from "@/lib/homestead/types";
import { cn } from "@/lib/utils";

import { FoundResourcesRow } from "../../../shared/ui/found-resources-row";
import {
  bodyTextClass,
  cardInteractiveGlowClass,
  controlLabelClass,
  getCardInspectionShineColors,
  viewCardWidthClass,
} from "@/features/alchemy/shared/config";
import type { MysteryChoice, MysteryEffect } from "@/lib/mystery";
import type { GearInstance } from "@/lib/gear";
import { BattleCardButton } from "../../../shared/ui/cards/card-button";
import { CardTitle, getCardDisplayTitle } from "../../../shared/ui/cards/card-description-ui";
import { GearTile, TrinketTile } from "../../../shared/ui/collection-art-tiles";
import { GearItemTitle, TrinketItemTitle } from "../../../shared/ui/gear-item-title";
import { MysteryEffectBadge } from "./mystery-effect-badge";
import { useInteractiveCard } from "../../../shared/ui/use-interactive-card";
import { KeywordProgressGrid } from "../keyword-progress-grid";
import { pairMysteryEffectsWithGrants } from "./mystery-choice-utils";

interface LookupProps {
  findCard: (id: string) => BattleCard | undefined;
  findTrinket: (id: string) => TrinketEntry | undefined;
}

function MysteryCardRewardItem({ card }: { card: BattleCard }) {
  const i18n = useGameTranslation();
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard(
    "mystery-reward",
    card.id,
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <BattleCardButton
        card={card}
        hovered={isHovered}
        onHoverStart={onHoverStart}
        onHoverEnd={onHoverEnd}
        ariaLabel={i18n.read(() => getCardDisplayTitle(card))}
        shimmerActive={shimmerActive}
        shimmerToken={shimmerToken}
        shineColor={getCardInspectionShineColors(card)}
        className={cn(viewCardWidthClass, cardInteractiveGlowClass)}
      />
      <p className={controlLabelClass}>
        <CardTitle card={card} />
      </p>
    </div>
  );
}

function MysteryEquipmentRewardItem({ item }: { item: TrinketEntry | GearInstance }) {
  useGameTranslation();
  const gear = "instanceId" in item;
  return (
    <div className="flex flex-col items-center gap-3">
      {gear ? (
        <GearTile instance={item} interactionKey="mystery-reward" />
      ) : (
        <TrinketTile trinket={item} interactionKey="mystery-reward" temporary />
      )}
      <p className={controlLabelClass}>
        {gear ? <GearItemTitle instance={item} /> : <TrinketItemTitle trinket={item} />}
      </p>
    </div>
  );
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
  const xpKeywords = new Set<Extract<MysteryEffect, { kind: "gainXP" }>["keyword"]>();
  let totalGold = 0;
  let hasResources = false;
  const mats: Partial<Record<MaterialId, number>> = {};
  for (const effect of choice.effects) {
    if (effect.kind === "gainXP") xpKeywords.add(effect.keyword);
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
        entries={[...xpKeywords].map((kw) => ({
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
