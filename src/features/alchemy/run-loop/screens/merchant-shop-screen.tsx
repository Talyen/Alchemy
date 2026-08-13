// Merchant shop screen — buy cards, remove deck cards, or refresh the shop.
import { useState } from "react";
import { Trash2 } from "lucide-react";

import type { BattleCard } from "@/lib/game-data";

import { PurchasableCardItem } from "../../shared/ui/shop-card-item";
import { RemoveCardPanel } from "../../shared/ui/remove-card-panel";
import { ScreenDescription, ServiceButton } from "../../shared/ui/shared-ui";
import { RefreshShopServiceButton, ShopBrowseOfferings, ShopBrowseShell } from "./shop-browse-shell";

export function MerchantShopScreen({
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
  onOpenMenu,
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
  onRemoveCard: (cardIndex: number) => void;
  onRefresh: () => void;
  onContinue: () => void;
  onOpenMenu: (rect?: DOMRect) => void;
}) {
  const [removeMode, setRemoveMode] = useState(false);

  return (
    <ShopBrowseShell title="Merchant's Shop" gold={gold} onOpenMenu={onOpenMenu}>
      {!removeMode ? (
        <ShopBrowseOfferings
          swapKey={shopCards.map((card) => card.id).join("-")}
          onLeave={onContinue}
          services={
            <>
              <ServiceButton
                icon={Trash2}
                label="Remove Card"
                cost={removePrice}
                disabled={gold < removePrice}
                disabledMessage="Not Enough Gold"
                used={removeUsed}
                soldOutText="Remove Card — Sold Out"
                onClick={() => {
                  setRemoveMode(true);
                }}
              />
              <RefreshShopServiceButton
                gold={gold}
                refreshesLeft={refreshesLeft}
                refreshPrice={refreshPrice}
                onRefresh={onRefresh}
              />
            </>
          }
        >
          {shopCards.map((card, i) => {
            const slotKey = `${card.id}-${i}`;
            return (
              <PurchasableCardItem
                key={slotKey}
                card={card}
                price={getCardPrice(card)}
                gold={gold}
                purchased={purchasedSlotKeys.includes(slotKey)}
                onBuy={() => onBuyCard(card, slotKey)}
              />
            );
          })}
        </ShopBrowseOfferings>
      ) : (
        <RemoveCardPanel
          runDeck={runDeck}
          intro={<ScreenDescription>Select a card to remove from your deck</ScreenDescription>}
          gold={gold}
          removePrice={removePrice}
          onConfirm={(index) => {
            onRemoveCard(index);
            setRemoveMode(false);
          }}
          onCancel={() => setRemoveMode(false)}
        />
      )}
    </ShopBrowseShell>
  );
}
