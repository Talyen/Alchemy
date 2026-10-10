import { useEffect, useRef, useState } from "react";
import { FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type BattleCard } from "@/lib/game-data";
import { PotionComparison } from "./potion-comparison";
import { BrewPotionPanel } from "./brew-potion-panel";
import { isBrewablePotion, strengthenPotion, type BrewOperation } from "@/lib/alchemist/brewing";
import { collectionTileWidthClass, getCardInspectionShineColors } from "@/features/alchemy/shared/config";

import { BattleCardButton } from "../../shared/ui/cards/card-button";
import { PurchasableCardItem } from "../shop/ui/purchasable-shop-item";
import { ServiceButton } from "../shop/ui/service-button";
import { GenericShopScreen } from "./generic-shop-screen";
import { ShopBrowseShell } from "./shop-browse-shell";
import { FadeSlot } from "../../shared/ui/use-fade";
import { shopItemSlotKey } from "../shop/shop-slot-keys";

export function AlchemistShopScreen({
  gold,
  runDeck,
  potionCards,
  refreshesLeft,
  mixUsed,
  purchasedSlotKeys,
  getPotionPrice,
  mixPrice,
  refreshPrice,
  onBuyCard,
  onRefresh,
  onMixPotions,
  onStrengthenPotion,
  potency,
  onContinue,
  afterProgressSaved = (feedback) => feedback(),
  isProgressSavePending = () => false,
}: {
  gold: number;
  runDeck: BattleCard[];
  potionCards: BattleCard[];
  refreshesLeft: number;
  mixUsed: boolean;
  purchasedSlotKeys: string[];
  getPotionPrice: (card: BattleCard) => number;
  mixPrice: number;
  refreshPrice: number;
  onBuyCard: (card: BattleCard, slotKey: string) => boolean;
  onRefresh: () => void;
  onMixPotions: (indexA: number, indexB: number) => BattleCard | null;
  onStrengthenPotion: (index: number) => BattleCard | null;
  potency: number;
  onContinue: () => void;
  afterProgressSaved?: (feedback: () => void) => void;
  isProgressSavePending?: () => boolean;
}) {
  const [brewMode, setBrewMode] = useState<"combine" | "strengthen" | null>(null);
  const [mixedCard, setMixedCard] = useState<BattleCard | null>(null);
  const [originalPotion, setOriginalPotion] = useState<BattleCard | null>(null);
  const resultSequence = useRef(0);
  useEffect(
    () => () => {
      resultSequence.current++;
    },
    [],
  );
  const mixable = runDeck.filter(isBrewablePotion);
  const mixDisabled = gold < mixPrice || mixable.length < 2;
  const strengthenDisabled = gold < mixPrice || !mixable.some((card) => strengthenPotion(card));
  const mixDisabledMessage = gold < mixPrice ? "Not Enough Gold" : "Two eligible Potions required";
  const modeKey = mixedCard ? "result" : (brewMode ?? "browse");
  function confirm(operation: BrewOperation): BattleCard | null {
    const original = operation.kind === "strengthen" ? runDeck[operation.index] : null;
    const result =
      operation.kind === "combine"
        ? onMixPotions(...operation.indices)
        : operation.kind === "strengthen"
          ? onStrengthenPotion(operation.index)
          : null;
    if (result) {
      const sequence = ++resultSequence.current;
      afterProgressSaved(() => {
        if (resultSequence.current === sequence) {
          setOriginalPotion(original ?? null);
          setMixedCard(result);
        }
      });
    }
    return result;
  }
  return (
    <FadeSlot swapKey={modeKey} className="h-full w-full">
      {mixedCard ? (
        <ShopBrowseShell title="Alchemist's Shop" gold={gold} showGold={false}>
          <div className="flex flex-col items-center gap-6">
            {originalPotion ? (
              <PotionComparison original={originalPotion} result={mixedCard} />
            ) : (
              <div className="flex flex-col items-center gap-3">
                <BattleCardButton
                  card={mixedCard}
                  ariaLabel={mixedCard.title}
                  shimmerActive={false}
                  shimmerToken={undefined}
                  shineColor={getCardInspectionShineColors(mixedCard)}
                  className={collectionTileWidthClass}
                />
              </div>
            )}
            <div>
              <Button
                size="lg"
                className="min-w-56"
                onClick={() => {
                  setMixedCard(null);
                  setBrewMode(null);
                }}
              >
                Continue
              </Button>
            </div>
          </div>
        </ShopBrowseShell>
      ) : brewMode ? (
        <ShopBrowseShell title="Alchemist's Shop" gold={gold}>
          <BrewPotionPanel
            deck={runDeck}
            kind={brewMode}
            selectionSound="shopSelect"
            price={mixPrice}
            gold={gold}
            potency={potency}
            isProgressSavePending={isProgressSavePending}
            onConfirm={confirm}
            onBack={() => {
              resultSequence.current++;
              setBrewMode(null);
            }}
          />
        </ShopBrowseShell>
      ) : (
        <GenericShopScreen
          title="Alchemist's Shop"
          gold={gold}
          items={potionCards}
          refreshesLeft={refreshesLeft}
          refreshPrice={refreshPrice}
          purchasedSlotKeys={purchasedSlotKeys}
          getSlotKey={(card, i) => shopItemSlotKey(card.id, i)}
          getPrice={getPotionPrice}
          onBuy={onBuyCard}
          onRefresh={onRefresh}
          onContinue={onContinue}
          isProgressSavePending={isProgressSavePending}
          extraServices={
            <>
              <ServiceButton
                icon={FlaskConical}
                label="Mix Potion"
                cost={mixPrice}
                disabled={mixDisabled}
                disabledMessage={mixDisabledMessage}
                used={mixUsed}
                soldOutText="Mix Potion - Used"
                onClick={() => setBrewMode("combine")}
              />
              <ServiceButton
                icon={FlaskConical}
                label="Distill"
                cost={mixPrice}
                disabled={strengthenDisabled}
                disabledMessage={gold < mixPrice ? "Not Enough Gold" : "No eligible Potions to distill"}
                used={mixUsed}
                soldOutText="Distill - Used"
                onClick={() => setBrewMode("strengthen")}
              />
            </>
          }
          renderItem={(card, price, purchased, onBuy) => (
            <PurchasableCardItem card={card} price={price} gold={gold} purchased={purchased} onBuy={onBuy} />
          )}
        />
      )}
    </FadeSlot>
  );
}
