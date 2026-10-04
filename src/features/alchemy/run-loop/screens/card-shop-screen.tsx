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
  const [removeError, setRemoveError] = useState("");

  return (
    <FadeSlot swapKey={removeMode ? "remove" : "browse"} className="h-full w-full">
      {removeMode ? (
        <div className="flex h-full min-h-0 w-full items-center justify-center px-5 py-7">
          {/* Bound the two-row fitting area in content units while keeping short-window controls reachable. */}
          <ScreenShell className="h-full max-h-[calc(70*var(--content-rem,1rem))] gap-6 overflow-hidden">
            <ScreenHeaderRow title="Remove Card" />
            {removeError && <p role="alert">{removeError}</p>}
            <RemoveCardPanel
              runDeck={runDeck}
              gold={gold}
              removePrice={removePrice}
              fitHeight
              onConfirm={(index) => {
                if (onRemoveCard(index)) {
                  setRemoveError("");
                  setRemoveMode(false);
                } else setRemoveError("Could not remove this card. Check your Gold and choose a card again.");
              }}
              onCancel={() => {
                setRemoveError("");
                setRemoveMode(false);
              }}
            />
          </ScreenShell>
        </div>
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
              disabled={runDeck.length === 0 || gold < removePrice}
              disabledMessage={runDeck.length === 0 ? "No Cards to Remove" : "Not Enough Gold"}
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
