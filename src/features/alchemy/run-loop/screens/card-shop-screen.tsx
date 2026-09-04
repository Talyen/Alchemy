import { useState } from "react";
import { Trash2 } from "lucide-react";

import type { BattleCard } from "@/lib/game-data";

import { PurchasableCardItem } from "../../shared/ui/purchasable-shop-item";
import { RemoveCardPanel } from "../../shared/ui/remove-card-panel";
import { ScreenDescription, ServiceButton } from "../../shared/ui/shared-ui";
import { shopItemSlotKey, shopOfferingsSwapKey } from "../shop/shop-slot-keys";
import { RefreshShopServiceButton, ShopBrowseOfferings, ShopBrowseShell } from "./shop-browse-shell";
import { FadeSlot } from "../../shared/ui/fade-slot";

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
    <ShopBrowseShell title="Card Shop" gold={gold}>
      <FadeSlot swapKey={removeMode ? "remove" : "browse"} className="w-full">
        {!removeMode ? (
          <ShopBrowseOfferings
            swapKey={shopOfferingsSwapKey(
              shopCards.map((card, i) => shopItemSlotKey(card.id, i)),
              refreshesLeft,
            )}
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
                  soldOutText="Remove Card - Sold Out"
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
              const slotKey = shopItemSlotKey(card.id, i);
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
              if (onRemoveCard(index)) setRemoveMode(false);
            }}
            onCancel={() => setRemoveMode(false)}
          />
        )}
      </FadeSlot>
    </ShopBrowseShell>
  );
}
