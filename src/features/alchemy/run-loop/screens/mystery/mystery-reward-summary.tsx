// Mystery consequence reward summary after run state has been updated.
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { type BattleCard, type KeywordId, type TalentXP, type TrinketEntry } from "@/lib/game-data";
import { type MaterialId } from "@/lib/homestead/types";
import { cn } from "@/lib/utils";

import { FoundResourcesRow } from "../../../shared/ui/found-resources-row";
import {
  BUTTON_WIDTH_ACTION,
  bodyTextClass,
  cardInteractiveGlowClass,
  cardSurfaceClass,
  collectionTileWidthClass,
  controlLabelClass,
  gearArtAspectClass,
  gearArtFillClass,
  trinketArtFillClass,
  trinketArtImageClass,
  trinketArtTileClass,
  viewCardWidthClass,
} from "@/features/alchemy/shared/config";
import type { MysteryChoice, MysteryEffect } from "@/lib/mystery";
import { gearDefinitions, getAstralShineColors, getGearInstanceTitle, type GearInstance } from "@/lib/gear";
import { GearDetailPopup } from "../../../shared/ui/gear-detail-popup";
import { BattleCardButton } from "../../../shared/ui/card-button";
import { CardTitle, getCardDisplayTitle } from "../../../shared/ui/card-description-ui";
import { DetailPopup } from "../../../shared/ui/card-popup";
import { InteractiveArtTile } from "../../../shared/ui/interactive-art-tile";
import { MysteryEffectBadge } from "../../../shared/ui/mystery-effect-badge";
import { useInteractiveCard } from "../../../shared/ui/use-interactive-card";
import { KeywordProgressGrid } from "../keyword-progress-grid";

interface LookupProps {
  findCard: (id: string) => BattleCard | undefined;
  findTrinket: (id: string) => TrinketEntry | undefined;
}

function renderFoundOrLost(effect: MysteryEffect, prefix: string) {
  return (
    <div className="flex items-center justify-center gap-2 text-lg font-medium text-balance text-muted-foreground">
      {prefix}
      <MysteryEffectBadge effect={effect} findCard={undefined} findTrinket={undefined} />
    </div>
  );
}

function MysteryCardRewardItem({ card }: { card: BattleCard }) {
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
        ariaLabel={getCardDisplayTitle(card)}
        shimmerActive={shimmerActive}
        shimmerToken={shimmerToken}
        className={cn(viewCardWidthClass, cardInteractiveGlowClass)}
      />
      <p className={controlLabelClass}>
        <CardTitle card={card} />
      </p>
    </div>
  );
}

function MysteryTrinketRewardItem({ boon }: { boon: TrinketEntry }) {
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
            footerChip="This Run"
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

function MysteryGearRewardItem({ instance }: { instance: GearInstance }) {
  const definition = gearDefinitions[instance.definitionId];
  const title = getGearInstanceTitle(instance);
  return (
    <div className="flex flex-col items-center gap-3">
      <InteractiveArtTile
        id={instance.instanceId}
        interactionKey="mystery-reward"
        title={title}
        art={definition?.art ?? ""}
        className={cn(cardSurfaceClass, collectionTileWidthClass, gearArtAspectClass)}
        imageClassName={gearArtFillClass}
        shineColor={getAstralShineColors(instance)}
        popup={({ visible, triggerRef }) => (
          <GearDetailPopup definition={definition} instance={instance} visible={visible} triggerRef={triggerRef} />
        )}
      />
      <p className={controlLabelClass}>{title}</p>
    </div>
  );
}

function MysteryRewardEffectItem({
  effect,
  findCard,
  findTrinket,
  grantedTrinketId,
  grantedGear,
  chosenCardId,
}: {
  effect: MysteryEffect;
  grantedTrinketId: string | undefined;
  grantedGear: GearInstance | undefined;
  chosenCardId: string | null;
} & LookupProps) {
  const rewardRenderers: Record<string, () => ReactNode> = {
    addCard: () => {
      const card = findCard((effect as { cardId: string }).cardId);
      return card ? <MysteryCardRewardItem card={card} /> : null;
    },
    chooseCard: () => {
      const card = chosenCardId ? findCard(chosenCardId) : undefined;
      return card ? <MysteryCardRewardItem card={card} /> : null;
    },
    gainTrinket: () => {
      const boon = findTrinket((effect as { trinketId: string }).trinketId);
      return boon ? <MysteryTrinketRewardItem boon={boon} /> : null;
    },
    gainRandomTrinket: () => {
      const boon = grantedTrinketId ? findTrinket(grantedTrinketId) : undefined;
      if (!boon) return <p className={cn(controlLabelClass, "text-balance")}>Gained a random trinket for this run</p>;
      return <MysteryTrinketRewardItem boon={boon} />;
    },
    gainGeneratedGear: () => {
      if (!grantedGear) return <p className={cn(controlLabelClass, "text-balance")}>Added Gear to your Armory</p>;
      return <MysteryGearRewardItem instance={grantedGear} />;
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
  grantedGearInstances,
  chosenCardId,
  runTalentXP = {},
  talentXP = {},
  onContinue,
}: {
  choice: MysteryChoice;
  grantedTrinketIds: string[];
  grantedGearInstances: GearInstance[];
  chosenCardId: string | null;
  runTalentXP?: TalentXP;
  talentXP?: TalentXP;
  onContinue: () => void;
} & LookupProps) {
  const xpEffects = choice.effects.filter((e): e is Extract<MysteryEffect, { kind: "gainXP" }> => e.kind === "gainXP");
  const resourceEffects = choice.effects.filter((e) => e.kind === "gainGold" || e.kind === "gainMaterial");
  const otherEffects = choice.effects.filter(
    (e) => e.kind !== "gainGold" && e.kind !== "gainMaterial" && e.kind !== "gainXP",
  );

  const xpByKeyword: Partial<Record<KeywordId, number>> = {};
  for (const effect of xpEffects) {
    xpByKeyword[effect.keyword] = (xpByKeyword[effect.keyword] ?? 0) + effect.amount;
  }
  const xpKeywordEntries = Object.entries(xpByKeyword) as Array<[KeywordId, number]>;

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
  let generatedGearCursor = 0;

  return (
    <div className="flex min-h-[56cqh] w-full flex-1 flex-col items-center justify-center space-y-6 text-center">
      {otherEffects.map((effect, i) => {
        const grantedTrinketId =
          effect.kind === "gainRandomTrinket" ? grantedTrinketIds[randomTrinketCursor++] : undefined;
        const grantedGear =
          effect.kind === "gainGeneratedGear" ? grantedGearInstances[generatedGearCursor++] : undefined;
        return (
          <div key={i}>
            <MysteryRewardEffectItem
              effect={effect}
              findCard={findCard}
              findTrinket={findTrinket}
              grantedTrinketId={grantedTrinketId}
              grantedGear={grantedGear}
              chosenCardId={chosenCardId}
            />
          </div>
        );
      })}

      <KeywordProgressGrid
        entries={xpKeywordEntries.map(([kw, amount]) => ({
          kw,
          runXP: amount,
          totalXP: (talentXP[kw] ?? 0) + (runTalentXP[kw] ?? 0),
        }))}
      />

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
