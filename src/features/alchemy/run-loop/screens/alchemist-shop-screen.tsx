import { useState } from "react";
import { FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type BattleCard } from "@/lib/game-data";
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
}) {
  const [mixMode, setMixMode] = useState(false);
  const [mixedCard, setMixedCard] = useState<BattleCard | null>(null);
  const mixable = runDeck.filter(isBrewablePotion);
  const mixDisabled = gold < mixPrice || (mixable.length < 2 && !mixable.some((card) => strengthenPotion(card)));
  const mixDisabledMessage = gold < mixPrice ? "Not Enough Gold" : "No eligible Potions to brew";
  const modeKey = mixedCard ? "result" : mixMode ? "mix" : "browse";
  function confirm(operation: BrewOperation): BattleCard | null {
    const result =
      operation.kind === "combine"
        ? onMixPotions(...operation.indices)
        : operation.kind === "strengthen"
          ? onStrengthenPotion(operation.index)
          : null;
    if (result) setMixedCard(result);
    return result;
  }
  return (
    <FadeSlot swapKey={modeKey} className="h-full w-full">
      {mixedCard ? (
        <ShopBrowseShell title="Alchemist's Shop" gold={gold} showGold={false}>
          <div className="flex flex-col items-center gap-6">
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
            <div>
              <Button
                size="lg"
                className="min-w-56"
                onClick={() => {
                  setMixedCard(null);
                  setMixMode(false);
                }}
              >
                Continue
              </Button>
            </div>
          </div>
        </ShopBrowseShell>
      ) : mixMode ? (
        <ShopBrowseShell title="Alchemist's Shop" gold={gold}>
          <BrewPotionPanel
            deck={runDeck}
            allowStrengthen
            price={mixPrice}
            gold={gold}
            potency={potency}
            onConfirm={confirm}
            onBack={() => setMixMode(false)}
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
          extraServices={
            <ServiceButton
              icon={FlaskConical}
              label="Brew Potion"
              cost={mixPrice}
              disabled={mixDisabled}
              disabledMessage={mixDisabledMessage}
              used={mixUsed}
              soldOutText="Brew Potion - Used"
              onClick={() => setMixMode(true)}
            />
          }
          renderItem={(card, price, purchased, onBuy) => (
            <PurchasableCardItem card={card} price={price} gold={gold} purchased={purchased} onBuy={onBuy} />
          )}
        />
      )}
    </FadeSlot>
  );
}
