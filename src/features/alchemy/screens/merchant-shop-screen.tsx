// Merchant shop screen — buy cards, remove deck cards, or refresh the shop.
import { useState } from "react";
import type { CSSProperties } from "react";
import { Coins } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BattleCard } from "@/lib/game-data";
import { SHOP_CARD_PRICE, SHOP_REFRESH_PRICE, SHOP_REMOVE_PRICE, COLLECTION_PAGE_SIZE } from "@/lib/game-constants";

import { BattleCardButton } from "../ui/card-ui";
import { DisabledTooltip, GoldCost, PaginationControls } from "../ui/shared-ui";
import { collectionCardWidthClass, handCardWidthClass } from "../config";

function ShopCardItem({ card, price, gold, purchased, onBuy, index }: { card: BattleCard; price: number; gold: number; purchased: boolean; onBuy: () => void; index: number }) {
  const [hovered, setHovered] = useState(false);

  if (purchased) {
    return (
      <div className="stagger-item flex flex-col items-center gap-3 rounded-[18px] border border-border/30 bg-card/30 p-4 text-center opacity-50" style={{ "--stagger-index": index } as CSSProperties}>
        <div onMouseEnter={() => {}} onMouseLeave={() => {}}>
          <BattleCardButton card={card} hovered={false} onHoverStart={() => {}} onHoverEnd={() => {}} ariaLabel={card.title} shimmerActive={false} className={handCardWidthClass} />
        </div>
        <p className="text-sm font-semibold text-muted-foreground">{card.title}</p>
        <span className="text-xs text-muted-foreground">Purchased</span>
      </div>
    );
  }

  return (
    <div className="stagger-item flex flex-col items-center gap-3 rounded-[18px] border border-border/70 bg-card/60 p-4 text-center" style={{ "--stagger-index": index } as CSSProperties}>
      <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <BattleCardButton card={card} hovered={hovered} onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)} ariaLabel={`Inspect ${card.title}`} shimmerActive={false} className={handCardWidthClass} />
      </div>
      <p className="text-sm font-semibold text-foreground">{card.title}</p>
      <DisabledTooltip show={gold < price} message="Not Enough Gold">
        <Button size="sm" variant="outline" disabled={gold < price} onClick={onBuy}>
          Buy <GoldCost amount={price} />
        </Button>
      </DisabledTooltip>
    </div>
  );
}

function DeckCardItem({ card, index, visualIndex, isSelected, onSelect }: { card: BattleCard; index: number; visualIndex: number; isSelected: boolean; onSelect: (index: number) => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={cn("stagger-item cursor-pointer rounded-[18px] border p-2 text-center transition-all", isSelected ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border/60 bg-card/40 hover:border-border")}
      style={{ "--stagger-index": visualIndex } as CSSProperties}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(index)}
    >
      <BattleCardButton card={card} hovered={hovered} onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)} ariaLabel={`Inspect ${card.title}`} shimmerActive={false} className={collectionCardWidthClass} />
      <p className="mt-1 text-xs font-semibold text-foreground">{card.title}</p>
    </div>
  );
}

function DeckGridPaginated({
  cards, selectedIndex, onSelect, page, onPageChange, pageSize,
}: {
  cards: BattleCard[]; selectedIndex: number | null; onSelect: (index: number) => void;
  page: number; onPageChange: (page: number) => void; pageSize: number;
}) {
  const totalPages = Math.max(1, Math.ceil(cards.length / pageSize));
  const pageItems = cards.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div>
      <div className="grid grid-cols-5 grid-rows-2 items-start justify-items-center gap-x-4 gap-y-5">
        {pageItems.map((card, i) => {
          const realIndex = page * pageSize + i;
          return <DeckCardItem key={`${card.id}-${realIndex}`} card={card} index={realIndex} visualIndex={i} isSelected={selectedIndex === realIndex} onSelect={onSelect} />;
        })}
        {Array.from({ length: Math.max(0, pageSize - pageItems.length) }).map((_, i) => (
          <div key={`deck-filler-${i}`} className={collectionCardWidthClass} aria-hidden="true" />
        ))}
      </div>
      <PaginationControls page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}

export function MerchantShopScreen({
  gold, shopCards, runDeck, refreshesLeft, removeUsed,
  onBuyCard, onRemoveCard, onRefresh, onContinue,
}: {
  gold: number; shopCards: BattleCard[]; runDeck: BattleCard[]; refreshesLeft: number; removeUsed: boolean;
  onBuyCard: (card: BattleCard) => void; onRemoveCard: (cardIndex: number) => void;
  onRefresh: () => void; onContinue: () => void;
}) {
  const [removeMode, setRemoveMode] = useState(false);
  const [selectedRemoveIndex, setSelectedRemoveIndex] = useState<number | null>(null);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [removePage, setRemovePage] = useState(0);
  const deckPageSize = COLLECTION_PAGE_SIZE;

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
      <h1 className="text-4xl text-foreground">Merchant's Shop</h1>
      <p className="flex items-center gap-2 text-lg font-medium text-yellow-300"><Coins className="h-5 w-5" />{gold} Gold</p>

      {!removeMode ? (
        <>
          <div key={shopCards.map((card) => card.id).join("-")} className="state-swap grid grid-cols-1 gap-4 sm:grid-cols-3">
            {shopCards.map((card, i) => (
              <ShopCardItem key={`${card.id}-${i}`} card={card} price={SHOP_CARD_PRICE} gold={gold} purchased={purchasedIds.has(card.id)} onBuy={() => handleBuyCard(card)} index={i} />
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {removeUsed ? (
              <Button variant="outline" disabled className="text-muted-foreground/40">Remove Card — Sold Out</Button>
            ) : (
              <DisabledTooltip show={gold < SHOP_REMOVE_PRICE} message="Not Enough Gold">
                <Button variant="outline" disabled={gold < SHOP_REMOVE_PRICE} onClick={() => { setRemoveMode(true); setRemovePage(0); }}>
                  Remove Card — <GoldCost amount={SHOP_REMOVE_PRICE} />
                </Button>
              </DisabledTooltip>
            )}
            <Button variant="outline" disabled={refreshesLeft <= 0 || gold < SHOP_REFRESH_PRICE} onClick={onRefresh}>
              Refresh — <GoldCost amount={SHOP_REFRESH_PRICE} />
            </Button>
          </div>
        </>
      ) : (
        <div className="state-swap">
          <p className="mb-4 text-sm text-muted-foreground">Select a card to remove from your deck</p>
          <DeckGridPaginated cards={runDeck} selectedIndex={selectedRemoveIndex} onSelect={(realIndex) => setSelectedRemoveIndex(realIndex)} page={removePage} onPageChange={setRemovePage} pageSize={deckPageSize} />
          <div className="mt-5 flex justify-center gap-3">
            <Button variant="ghost" onClick={() => { setRemoveMode(false); setSelectedRemoveIndex(null); setRemovePage(0); }}>Cancel</Button>
            <Button size="lg" disabled={selectedRemoveIndex === null || gold < SHOP_REMOVE_PRICE} onClick={handleRemoveConfirm}>
              Remove Card — <GoldCost amount={SHOP_REMOVE_PRICE} />
            </Button>
          </div>
        </div>
      )}

      <Button size="lg" className="mt-2 min-w-44" onClick={onContinue}>Continue</Button>
    </div>
  );
}
