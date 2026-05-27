// Mystery consequence reward summary after run state has been updated.
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { type BattleCard, type TrinketEntry } from "@/lib/game-data";
import { MATERIAL_IDS } from "@/lib/homestead/types";
import { cn } from "@/lib/utils";

import { GoldPill, MaterialPill } from "../../ui/material-icons";
import { cardSurfaceClass, collectionTileWidthClass, viewCardWidthClass } from "../../config";
import type { MysteryChoice, MysteryEffect } from "../../mystery-events";
import { TiltSurface } from "../../ui/tilt-surface";
import { BattleCardButton } from "../../ui/card-button";
import { CardTitle, getCardDisplayTitle } from "../../ui/card-description-ui";
import { DetailPopup } from "../../ui/card-popup";
import { MysteryEffectBadge } from "../../ui/mystery-effect-badge";
import { ScreenHeader } from "../../ui/shared-ui";

type LookupProps = {
  findCard: (id: string) => BattleCard | undefined;
  findTrinket: (id: string) => TrinketEntry | undefined;
};

function renderFoundOrLost(effect: MysteryEffect, prefix: string) {
  return (
    <div className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
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
        <p className="text-sm font-semibold text-foreground">
          <CardTitle card={card} />
        </p>
        <p className="text-sm text-muted-foreground">
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
      const trinket = findTrinket((effect as { trinketId: string }).trinketId);
      if (!trinket) return null;
      return (
        <div className="flex flex-col items-center gap-3">
          <div className="relative" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
            {isHovered ? (
              <DetailPopup
                idPrefix={trinket.id}
                title={trinket.title}
                subtitle={undefined}
                descriptionLines={trinket.descriptionLines}
              />
            ) : null}
            <TiltSurface className={cn(cardSurfaceClass, collectionTileWidthClass)}>
              <img
                src={trinket.art}
                alt={trinket.title}
                className="block w-full rounded-shell-hero aspect-square"
                loading="eager"
              />
            </TiltSurface>
          </div>
          <p className="text-sm font-semibold text-foreground">{trinket.title}</p>
          <p className="text-sm text-muted-foreground">Added {trinket.title} to your Inventory</p>
        </div>
      );
    },
    gainRandomTrinket: () => <p className="text-sm font-semibold text-foreground">Gained a random trinket</p>,
    gainGold: () => renderFoundOrLost(effect, "Found"),
    gainMaterial: () => renderFoundOrLost(effect, "Found"),
    loseGold: () => renderFoundOrLost(effect, "Lost"),
    removeCard: () => null,
    none: () => null,
  };

  const render =
    rewardRenderers[effect.kind] ??
    (() => (
      <p className="text-base text-muted-foreground">
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

  const mats: Record<string, number> = {};
  for (const e of resourceEffects) {
    if (e.kind === "gainMaterial") {
      mats[e.material] = (mats[e.material] ?? 0) + e.amount;
    }
  }

  return (
    <div className="state-swap space-y-6 text-center">
      <ScreenHeader title={eventTitle} />

      {otherEffects.map((effect, i) => (
        <MysteryRewardEffectItem
          key={i}
          effect={effect}
          runDeck={runDeck}
          findCard={findCard}
          findTrinket={findTrinket}
        />
      ))}

      {resourceEffects.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
          Found
          {totalGold > 0 ? <GoldPill amount={totalGold} /> : null}
          {MATERIAL_IDS.filter((mat) => mats[mat] > 0).map((mat) => (
            <MaterialPill key={mat} material={mat} amount={mats[mat]} />
          ))}
        </div>
      )}

      <Button size="lg" onClick={onContinue}>
        Continue
      </Button>
    </div>
  );
}
