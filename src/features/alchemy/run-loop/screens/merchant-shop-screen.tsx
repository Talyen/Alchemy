// Merchant shop screen — buy cards, remove deck cards, or refresh the shop.
import { useMemo, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BUTTON_WIDTH_ACTION } from "@/features/alchemy/shared/config";
import type { BattleCard } from "@/lib/game-data";
import { SELECTION_GRID_PAGE_SIZE } from "@/lib/game-constants";

import { PurchasableCardItem, SelectableShopCard } from "../../shared/ui/shop-card-item";
import { CardSelectionGrid } from "../../shared/ui/card-selection-grid";
import {
  GoldCost,
  GoldDisplay,
  ScreenDescription,
  ScreenHeader,
  ServiceButton,
  StaggerGroup,
} from "../../shared/ui/shared-ui";

function DeckGridPaginated({
  cards,
  selectedIndex,
  onSelect,
  page,
  onPageChange,
  pageSize,
  paginationSize = "sm",
  paginationReserveSpace = false,
}: {
  cards: BattleCard[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  page: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  paginationSize?: "sm" | "default";
  paginationReserveSpace?: boolean;
}) {
  const items = useMemo(() => cards.map((card, index) => ({ card, index })), [cards]);

  return (
    <CardSelectionGrid
      items={items}
      page={page}
      onPageChange={onPageChange}
      pageSize={pageSize}
      paginationSize={paginationSize}
      paginationReserveSpace={paginationReserveSpace}
      renderItem={({ card, index }) => (
        <SelectableShopCard card={card} isSelected={selectedIndex === index} onSelect={() => onSelect(index)} />
      )}
    />
  );
}

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
  const [selectedRemoveIndex, setSelectedRemoveIndex] = useState<number | null>(null);
  const [removePage, setRemovePage] = useState(0);
  const deckPageSize = SELECTION_GRID_PAGE_SIZE;

  function handleBuyCard(card: BattleCard, slotKey: string) {
    if (purchasedSlotKeys.includes(slotKey)) return;
    onBuyCard(card, slotKey);
  }

  function handleRemoveConfirm() {
    if (selectedRemoveIndex === null) return;
    onRemoveCard(selectedRemoveIndex);
    setRemoveMode(false);
    setSelectedRemoveIndex(null);
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
                setRemovePage(0);
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
        <StaggerGroup>
          <ScreenDescription className="mb-4">Select a card to remove from your deck</ScreenDescription>
          <DeckGridPaginated
            cards={runDeck}
            selectedIndex={selectedRemoveIndex}
            onSelect={(realIndex) => setSelectedRemoveIndex(realIndex)}
            page={removePage}
            onPageChange={setRemovePage}
            pageSize={deckPageSize}
            paginationSize="default"
            paginationReserveSpace
          />
          <div className="mt-5 flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setRemoveMode(false);
                setSelectedRemoveIndex(null);
                setRemovePage(0);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              disabled={selectedRemoveIndex === null || gold < removePrice}
              onClick={handleRemoveConfirm}
            >
              <Trash2 className="h-4 w-4" /> Remove Card <GoldCost amount={removePrice} />
            </Button>
          </div>
        </StaggerGroup>
      )}
    </div>
  );
}
