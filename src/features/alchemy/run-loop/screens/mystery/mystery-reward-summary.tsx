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
  controlLabelClass,
  trinketArtFillClass,
  trinketArtImageClass,
  trinketArtTileClass,
  viewCardWidthClass,
} from "@/features/alchemy/shared/config";
import type { MysteryChoice, MysteryEffect } from "@/lib/mystery";
import { BattleCardButton } from "../../../shared/ui/card-button";
import { CardTitle, getCardDisplayTitle } from "../../../shared/ui/card-description-ui";
import { DetailPopup } from "../../../shared/ui/card-popup";
import { InteractiveArtTile } from "../../../shared/ui/interactive-art-tile";
import { MysteryEffectBadge } from "../../../shared/ui/mystery-effect-badge";

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
  findCard,
  findTrinket,
  grantedTrinketId,
  chosenCardId,
}: {
  effect: MysteryEffect;
  grantedTrinketId: string | undefined;
  chosenCardId: string | null;
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
      </div>
    );
  }

  function renderTrinketReward(boon: TrinketEntry) {
    return (
      <div className="flex flex-col items-center gap-3">
        <InteractiveArtTile
          id={boon.id}
          interactionKey="mystery-reward"
          title={boon.title}
          art={boon.art}
          className={trinketArtTileClass}
          imageClassName={cn(trinketArtFillClass, trinketArtImageClass)}
          popup={({ visible, triggerRef }) => (
            <DetailPopup
              idPrefix={boon.id}
              title={boon.title}
              subtitle="This Run"
              descriptionLines={boon.descriptionLines}
              visible={visible}
              triggerRef={triggerRef}
            />
          )}
        />
        <p className={controlLabelClass}>{boon.title}</p>
      </div>
    );
  }

  const rewardRenderers: Record<string, () => ReactNode> = {
    addCard: () => {
      const card = findCard((effect as { cardId: string }).cardId);
      return card ? renderCardReward(card) : null;
    },
    chooseCard: () => {
      const card = chosenCardId ? findCard(chosenCardId) : undefined;
      return card ? renderCardReward(card) : null;
    },
    gainTrinket: () => {
      const boon = findTrinket((effect as { trinketId: string }).trinketId);
      return boon ? renderTrinketReward(boon) : null;
    },
    gainRandomTrinket: () => {
      const boon = grantedTrinketId ? findTrinket(grantedTrinketId) : undefined;
      if (!boon) return <p className={controlLabelClass}>Gained a random trinket for this run</p>;
      return renderTrinketReward(boon);
    },
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
  findCard,
  findTrinket,
  grantedTrinketIds,
  chosenCardId,
  onContinue,
}: {
  choice: MysteryChoice;
  grantedTrinketIds: string[];
  chosenCardId: string | null;
  onContinue: () => void;
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

  let randomTrinketCursor = 0;

  return (
    <div className="space-y-6 text-center">
      {otherEffects.map((effect, i) => {
        const grantedTrinketId =
          effect.kind === "gainRandomTrinket" ? grantedTrinketIds[randomTrinketCursor++] : undefined;
        return (
          <div key={i}>
            <MysteryRewardEffectItem
              effect={effect}
              findCard={findCard}
              findTrinket={findTrinket}
              grantedTrinketId={grantedTrinketId}
              chosenCardId={chosenCardId}
            />
          </div>
        );
      })}

      {resourceEffects.length > 0 ? (
        <div>
          <FoundResourcesRow gold={totalGold} materials={mats} />
        </div>
      ) : null}

      <div>
        <Button size="lg" className={BUTTON_WIDTH_ACTION} onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
