// Merchant shop screen — buy cards, remove deck cards, or refresh the shop.
import { useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BUTTON_WIDTH_ACTION } from "@/features/alchemy/shared/config";
import type { BattleCard } from "@/lib/game-data";

import { PurchasableCardItem } from "../../shared/ui/shop-card-item";
import { RemoveCardPanel } from "../../shared/ui/remove-card-panel";
import { GoldDisplay, ScreenDescription, ScreenHeader, ServiceButton, StaggerGroup } from "../../shared/ui/shared-ui";

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
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-6 text-center">
      <ScreenHeader title="Merchant's Shop" />
      <GoldDisplay gold={gold} />

      {!removeMode ? (
        <StaggerGroup className="flex flex-col items-center gap-6">
          <StaggerGroup
            swapKey={shopCards.map((card) => card.id).join("-")}
            animate={false}
            className="grid grid-cols-1 gap-4 sm:grid-cols-3"
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
          </StaggerGroup>

          <div className="flex flex-wrap justify-center gap-3">
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
          </div>
          <Button size="lg" variant="primary" className={cn("mt-2", BUTTON_WIDTH_ACTION)} onClick={onContinue}>
            Leave
          </Button>
        </StaggerGroup>
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
    </div>
  );
}
