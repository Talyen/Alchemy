// Merchant shop screen — buy cards, remove deck cards, or refresh the shop.
import { useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";

import { BlurFade } from "@/components/ui/blur-fade";
import { Button } from "@/components/ui/button";
import type { BattleCard } from "@/lib/game-data";
import { SELECTION_GRID_PAGE_SIZE } from "@/lib/game-constants";

import { PurchasableCardItem, SelectableShopCard } from "../ui/card-ui";
import { CardSelectionGrid } from "../ui/card-selection-grid";
import { GoldCost, GoldDisplay, ScreenDescription, ScreenHeader, ServiceButton, staggerDelay } from "../ui/shared-ui";

function DeckGridPaginated({
  cards, selectedIndex, onSelect, page, onPageChange, pageSize, revealDelay, paginationSize = "sm", paginationReserveSpace = false,
}: {
  cards: BattleCard[]; selectedIndex: number | null; onSelect: (index: number) => void;
  page: number; onPageChange: (page: number) => void; pageSize: number; revealDelay?: number;
  paginationSize?: "sm" | "default"; paginationReserveSpace?: boolean;
}) {
  const items = cards.map((card, index) => ({ card, index }));

  return (
    <CardSelectionGrid
      items={items}
      page={page}
      onPageChange={onPageChange}
      pageSize={pageSize}
      revealDelay={revealDelay}
      paginationSize={paginationSize}
      paginationReserveSpace={paginationReserveSpace}
      renderItem={({ card, index }) => (
        <SelectableShopCard card={card} isSelected={selectedIndex === index} onSelect={() => onSelect(index)} />
      )}
    />
  );
}

export function MerchantShopScreen({
  gold, shopCards, runDeck, refreshesLeft, removeUsed,
  cardPrice, removePrice, refreshPrice,
  onBuyCard, onRemoveCard, onRefresh, onContinue,
}: {
  gold: number; shopCards: BattleCard[]; runDeck: BattleCard[]; refreshesLeft: number; removeUsed: boolean;
  cardPrice: number; removePrice: number; refreshPrice: number;
  onBuyCard: (card: BattleCard) => void; onRemoveCard: (cardIndex: number) => void;
  onRefresh: () => void; onContinue: () => void;
}) {
  const [removeMode, setRemoveMode] = useState(false);
  const [selectedRemoveIndex, setSelectedRemoveIndex] = useState<number | null>(null);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [removePage, setRemovePage] = useState(0);
  const deckPageSize = SELECTION_GRID_PAGE_SIZE;

  function handleBuyCard(card: BattleCard) {
    if (purchasedIds.has(card.id)) return;
    onBuyCard(card);
    setPurchasedIds((prev) => new Set(prev).add(card.id));
  }

  function handleRemoveConfirm() {
    if (selectedRemoveIndex === null) return;
    onRemoveCard(selectedRemoveIndex);
    setRemoveMode(false); setSelectedRemoveIndex(null);
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-6 text-center">
      <ScreenHeader title="Merchant's Shop" />
      <BlurFade delay={staggerDelay(1)} direction="up" offset={6}>
        <GoldDisplay gold={gold} />
      </BlurFade>

      {!removeMode ? (
        <div className="state-swap flex flex-col items-center gap-6">
          <div key={shopCards.map((card) => card.id).join("-")} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {shopCards.map((card, i) => (
              <BlurFade key={`${card.id}-${i}`} delay={staggerDelay(2 + i)} direction="up" offset={8}>
                <PurchasableCardItem card={card} price={cardPrice} gold={gold} purchased={purchasedIds.has(card.id)} onBuy={() => handleBuyCard(card)} />
              </BlurFade>
            ))}
          </div>

          <BlurFade delay={staggerDelay(5)} direction="up" offset={6}>
            <div className="flex flex-wrap justify-center gap-3">
              <ServiceButton
                icon={Trash2} label="Remove Card" cost={removePrice}
                disabled={gold < removePrice} disabledMessage="Not Enough Gold"
                used={removeUsed} soldOutText="Remove Card — Sold Out"
                onClick={() => { setRemoveMode(true); setRemovePage(0); }}
              />
              <ServiceButton
                icon={RefreshCw} label="Refresh" cost={refreshPrice}
                disabled={refreshesLeft <= 0 || gold < refreshPrice} disabledMessage="Not Enough Gold"
                used={refreshesLeft <= 0} soldOutText="Refresh — Sold Out"
                onClick={onRefresh}
              />
            </div>
          </BlurFade>
          <BlurFade delay={staggerDelay(6)} direction="up" offset={6}>
            <Button size="lg" className="mt-2 min-w-44" onClick={onContinue}>Leave</Button>
          </BlurFade>
        </div>
      ) : (
        <div className="state-swap">
          <ScreenDescription className="mb-4">Select a card to remove from your deck</ScreenDescription>
          <DeckGridPaginated cards={runDeck} selectedIndex={selectedRemoveIndex} onSelect={(realIndex) => setSelectedRemoveIndex(realIndex)} page={removePage} onPageChange={setRemovePage} pageSize={deckPageSize} revealDelay={staggerDelay(2)} paginationSize="default" paginationReserveSpace />
          <div className="mt-5 flex justify-center gap-3">
            <BlurFade delay={staggerDelay(10)} direction="up" offset={6}>
              <Button variant="ghost" onClick={() => { setRemoveMode(false); setSelectedRemoveIndex(null); setRemovePage(0); }}>Cancel</Button>
            </BlurFade>
            <BlurFade delay={staggerDelay(11)} direction="up" offset={6}>
              <Button variant="outline" disabled={selectedRemoveIndex === null || gold < removePrice} onClick={handleRemoveConfirm}>
                <Trash2 className="h-4 w-4" /> Remove Card <GoldCost amount={removePrice} />
              </Button>
            </BlurFade>
          </div>
        </div>
      )}
    </div>
  );
}
