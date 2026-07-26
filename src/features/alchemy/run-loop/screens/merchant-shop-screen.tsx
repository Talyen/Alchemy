// Merchant shop screen — buy cards, remove deck cards, or refresh the shop.
import { useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";

import type { BattleCard } from "@/lib/game-data";

import { PurchasableCardItem } from "../../shared/ui/shop-card-item";
import { RemoveCardPanel } from "../../shared/ui/remove-card-panel";
import { ScreenDescription, ServiceButton } from "../../shared/ui/shared-ui";
import { ShopBrowseOfferings, ShopBrowseShell } from "./shop-browse-shell";

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
}) {
  const [removeMode, setRemoveMode] = useState(false);

  function handleBuyCard(card: BattleCard, slotKey: string) {
    if (purchasedSlotKeys.includes(slotKey)) return;
    onBuyCard(card, slotKey);
  }

  return (
    <ShopBrowseShell title="Merchant's Shop" gold={gold}>
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
              <ServiceButton
                icon={RefreshCw}
                label="Refresh"
                cost={refreshPrice}
                disabled={refreshesLeft <= 0 || gold < refreshPrice}
                disabledMessage="Not Enough Gold"
                used={refreshesLeft <= 0}
                soldOutText="Refresh — Sold Out"
                onClick={onRefresh}
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
                onBuy={() => handleBuyCard(card, slotKey)}
                staggerIndex={i}
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
