// Mystery consequence reward summary after run state has been updated.
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { type BattleCard, type TrinketEntry } from "@/lib/game-data";
import { type MaterialId } from "@/lib/homestead/types";
import { cn } from "@/lib/utils";

import { FoundResourcesRow } from "../../../shared/ui/found-resources-row";
import {
  BUTTON_WIDTH_ACTION,
  bodyTextClass,
  cardSurfaceClass,
  collectionTileWidthClass,
  controlLabelClass,
  viewCardWidthClass,
} from "@/features/alchemy/shared/config";
import type { MysteryChoice, MysteryEffect } from "@/lib/mystery";
import { TiltSurface } from "../../../shared/ui/tilt-surface";
import { BattleCardButton } from "../../../shared/ui/card-button";
import { CardTitle, getCardDisplayTitle } from "../../../shared/ui/card-description-ui";
import { DetailPopup } from "../../../shared/ui/card-popup";
import { MysteryEffectBadge } from "../../../shared/ui/mystery-effect-badge";
import { ScreenHeader, StaggerGroup, StaggerItem } from "../../../shared/ui/shared-ui";

interface LookupProps {
  findCard: (id: string) => BattleCard | undefined;
  findTrinket: (id: string) => TrinketEntry | undefined;
}

function renderFoundOrLost(effect: MysteryEffect, prefix: string) {
  return (
    <div className="flex items-center justify-center gap-2 text-lg font-medium text-muted-foreground">
      {prefix}
      <MysteryEffectBadge effect={effect} findCard={undefined} findTrinket={undefined} />
    </div>
  );
}

function MysteryRewardEffectItem({
  effect,
  runDeck,
  findCard,
  findTrinket,
}: {
  effect: MysteryEffect;
  runDeck: BattleCard[];
} & LookupProps) {
  const [isHovered, setIsHovered] = useState(false);

  function renderCardReward(card: BattleCard) {
    return (
      <div className="flex flex-col items-center gap-3">
        <BattleCardButton
          card={card}
          hovered={isHovered}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
          ariaLabel={getCardDisplayTitle(card)}
          shimmerActive={false}
          shimmerToken={undefined}
          className={viewCardWidthClass}
        />
        <p className={controlLabelClass}>
          <CardTitle card={card} />
        </p>
        <p className={bodyTextClass}>
          Added <CardTitle card={card} /> to your Deck
        </p>
      </div>
    );
  }

  const rewardRenderers: Record<string, () => ReactNode> = {
    addCard: () => {
      const card = findCard((effect as { cardId: string }).cardId);
      return card ? renderCardReward(card) : null;
    },
    chooseCard: () => {
      const card = runDeck[runDeck.length - 1];
      return card ? renderCardReward(card) : null;
    },
    gainTrinket: () => {
      const boon = findTrinket((effect as { trinketId: string }).trinketId);
      if (!boon) return null;
      return (
        <div className="flex flex-col items-center gap-3">
          <div className="relative" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
            {isHovered ? (
              <DetailPopup
                idPrefix={boon.id}
                title={boon.title}
                subtitle={undefined}
                descriptionLines={boon.descriptionLines}
              />
            ) : null}
            <TiltSurface className={cn(cardSurfaceClass, collectionTileWidthClass)}>
              <img
                src={boon.art}
                alt={boon.title}
                className="block aspect-square w-full rounded-shell-hero"
                loading="eager"
              />
            </TiltSurface>
          </div>
          <p className={controlLabelClass}>{boon.title}</p>
          <p className={bodyTextClass}>Added {boon.title} to your Inventory</p>
        </div>
      );
    },
    gainRandomTrinket: () => <p className={controlLabelClass}>Gained a random trinket</p>,
    gainGold: () => renderFoundOrLost(effect, "Found"),
    gainMaterial: () => renderFoundOrLost(effect, "Found"),
    loseGold: () => renderFoundOrLost(effect, "Lost"),
    removeCard: () => null,
  };

  const render =
    rewardRenderers[effect.kind] ??
    (() => (
      <p className={bodyTextClass}>
        <MysteryEffectBadge effect={effect} findCard={findCard} findTrinket={findTrinket} />
      </p>
    ));

  return render();
}

export function MysteryRewardSummary({
  choice,
  runDeck,
  findCard,
  findTrinket,
  onContinue,
  eventTitle,
}: {
  choice: MysteryChoice;
  runDeck: BattleCard[];
  onContinue: () => void;
  eventTitle: string;
} & LookupProps) {
  const resourceEffects = choice.effects.filter((e) => e.kind === "gainGold" || e.kind === "gainMaterial");
  const otherEffects = choice.effects.filter((e) => e.kind !== "gainGold" && e.kind !== "gainMaterial");

  const totalGold = resourceEffects
    .filter((e): e is typeof e & { kind: "gainGold" } => e.kind === "gainGold")
    .reduce((sum, e) => sum + e.amount, 0);

  const mats: Partial<Record<MaterialId, number>> = {};
  for (const e of resourceEffects) {
    if (e.kind === "gainMaterial") {
      mats[e.material] = (mats[e.material] ?? 0) + e.amount;
    }
  }

  return (
    <StaggerGroup className="space-y-6 text-center">
      <StaggerItem index={0}>
        <ScreenHeader title={eventTitle} />
      </StaggerItem>

      {otherEffects.map((effect, i) => (
        <StaggerItem key={i} index={i + 1}>
          <MysteryRewardEffectItem effect={effect} runDeck={runDeck} findCard={findCard} findTrinket={findTrinket} />
        </StaggerItem>
      ))}

      {resourceEffects.length > 0 ? (
        <StaggerItem index={otherEffects.length + 1}>
          <FoundResourcesRow gold={totalGold} materials={mats} />
        </StaggerItem>
      ) : null}

      <StaggerItem index={otherEffects.length + (resourceEffects.length > 0 ? 2 : 1)}>
        <Button size="lg" className={BUTTON_WIDTH_ACTION} onClick={onContinue}>
          Continue
        </Button>
      </StaggerItem>
    </StaggerGroup>
  );
}
