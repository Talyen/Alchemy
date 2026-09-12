import { useState } from "react";
import { Trash2 } from "lucide-react";

import type { BattleCard } from "@/lib/game-data";

import { PurchasableCardItem } from "../shop/ui/purchasable-shop-item";
import { RemoveCardPanel } from "../../shared/ui/remove-card-panel";
import { ScreenHeaderRow, ScreenShell } from "../../shared/ui/layout-components";
import { ServiceButton } from "../shop/ui/service-button";
import { shopItemSlotKey } from "../shop/shop-slot-keys";
import { GenericShopScreen } from "./generic-shop-screen";
import { FadeSlot } from "../../shared/ui/use-fade";

export function CardShopScreen({
  gold,
  runDeck,
  shopCards,
  refreshesLeft,
  removeUsed,
  purchasedSlotKeys,
  getCardPrice,
  removePrice,
  refreshPrice,
  onBuyCard,
  onRemoveCard,
  onRefresh,
  onContinue,
}: {
  gold: number;
  runDeck: BattleCard[];
  shopCards: BattleCard[];
  refreshesLeft: number;
  removeUsed: boolean;
  purchasedSlotKeys: string[];
  getCardPrice: (card: BattleCard) => number;
  removePrice: number;
  refreshPrice: number;
  onBuyCard: (card: BattleCard, slotKey: string) => boolean;
  onRemoveCard: (cardIndex: number) => boolean;
  onRefresh: () => void;
  onContinue: () => void;
}) {
  const [removeMode, setRemoveMode] = useState(false);

  return (
    <FadeSlot swapKey={removeMode ? "remove" : "browse"} className="h-full w-full">
      {removeMode ? (
        <ScreenShell minHeightClass="min-h-0" className="h-full gap-3 overflow-hidden">
          <ScreenHeaderRow title="Remove Card" />
          <RemoveCardPanel
            runDeck={runDeck}
            gold={gold}
            removePrice={removePrice}
            fitHeight
            onConfirm={(index) => {
              if (onRemoveCard(index)) setRemoveMode(false);
            }}
            onCancel={() => setRemoveMode(false)}
          />
        </ScreenShell>
      ) : (
        <GenericShopScreen
          title="Card Shop"
          gold={gold}
          items={shopCards}
          refreshesLeft={refreshesLeft}
          refreshPrice={refreshPrice}
          purchasedSlotKeys={purchasedSlotKeys}
          getSlotKey={(card, i) => shopItemSlotKey(card.id, i)}
          getPrice={getCardPrice}
          onBuy={onBuyCard}
          onRefresh={onRefresh}
          onContinue={onContinue}
          extraServices={
            <ServiceButton
              icon={Trash2}
              label="Remove Card"
              cost={removePrice}
              disabled={gold < removePrice}
              disabledMessage="Not Enough Gold"
              used={removeUsed}
              soldOutText="Remove Card - Sold Out"
              onClick={() => {
                setRemoveMode(true);
              }}
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
