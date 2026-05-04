// Merchant shop screen — buy cards, remove deck cards, or refresh the shop.
import { useState } from "react";
import { Coins } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BattleCard } from "@/lib/game-data";
import { SHOP_CARD_PRICE, SHOP_REFRESH_PRICE, SHOP_REMOVE_PRICE } from "@/lib/game-constants";

import { BattleCardButton } from "../ui/card-ui";
import { handCardWidthClass } from "../config";

function ShopCardItem({ card, price, gold, purchased, onBuy }: { card: BattleCard; price: number; gold: number; purchased: boolean; onBuy: () => void }) {
  const [hovered, setHovered] = useState(false);

  if (purchased) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[18px] border border-border/30 bg-card/30 p-4 text-center opacity-50">
        <div onMouseEnter={() => {}} onMouseLeave={() => {}}>
          <BattleCardButton card={card} hovered={false} onHoverStart={() => {}} onHoverEnd={() => {}} ariaLabel={card.title} shimmerActive={false} className={handCardWidthClass} />
        </div>
        <p className="text-sm font-semibold text-muted-foreground">{card.title}</p>
        <span className="text-xs text-muted-foreground">Purchased</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-[18px] border border-border/70 bg-card/60 p-4 text-center">
      <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <BattleCardButton card={card} hovered={hovered} onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)} ariaLabel={`Inspect ${card.title}`} shimmerActive={false} className={handCardWidthClass} />
      </div>
      <p className="text-sm font-semibold text-foreground">{card.title}</p>
      <Button size="sm" disabled={gold < price} onClick={onBuy}>Buy for {price} Gold</Button>
    </div>
  );
}

function DeckCardItem({ card, index, isSelected, onSelect }: { card: BattleCard; index: number; isSelected: boolean; onSelect: (index: number) => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={cn("cursor-pointer rounded-[18px] border p-3 text-center transition-all", isSelected ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border/60 bg-card/40 hover:border-border")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(index)}
    >
      <BattleCardButton card={card} hovered={hovered} onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)} ariaLabel={`Inspect ${card.title}`} shimmerActive={false} />
      <p className="mt-2 text-xs font-semibold text-foreground">{card.title}</p>
    </div>
  );
}

export function MerchantShopScreen({
  gold,
  shopCards,
  runDeck,
  refreshesLeft,
  removeUsed,
  onBuyCard,
  onRemoveCard,
  onRefresh,
  onContinue,
}: {
  gold: number;
  shopCards: BattleCard[];
  runDeck: BattleCard[];
  refreshesLeft: number;
  removeUsed: boolean;
  onBuyCard: (card: BattleCard) => void;
  onRemoveCard: (cardIndex: number) => void;
  onRefresh: () => void;
  onContinue: () => void;
}) {
  const [removeMode, setRemoveMode] = useState(false);
  const [selectedRemoveIndex, setSelectedRemoveIndex] = useState<number | null>(null);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());

  function handleBuyCard(card: BattleCard) {
    if (purchasedIds.has(card.id)) return;
    onBuyCard(card);
    setPurchasedIds((prev) => new Set(prev).add(card.id));
  }

  function handleRemoveConfirm() {
    if (selectedRemoveIndex === null) return;
    onRemoveCard(selectedRemoveIndex);
    setRemoveMode(false);
    setSelectedRemoveIndex(null);
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-6 text-center">
      <h1 className="text-4xl font-semibold text-foreground">Merchant's Shop</h1>
      <p className="flex items-center gap-2 text-lg font-medium text-yellow-300">
        <Coins className="h-5 w-5" />{gold} Gold
      </p>

      {!removeMode ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {shopCards.map((card, i) => (
              <ShopCardItem key={`${card.id}-${i}`} card={card} price={SHOP_CARD_PRICE} gold={gold} purchased={purchasedIds.has(card.id)} onBuy={() => handleBuyCard(card)} />
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {removeUsed ? (
              <Button variant="outline" disabled className="text-muted-foreground/40">Remove Card — Sold Out</Button>
            ) : (
              <Button variant="outline" disabled={gold < SHOP_REMOVE_PRICE} onClick={() => setRemoveMode(true)}>
                Remove Card ({SHOP_REMOVE_PRICE} Gold)
              </Button>
            )}
            <Button variant="outline" disabled={refreshesLeft <= 0 || gold < SHOP_REFRESH_PRICE} onClick={onRefresh}>
              Refresh ({SHOP_REFRESH_PRICE} Gold)
            </Button>
          </div>
        </>
      ) : (
        <div>
          <p className="mb-4 text-sm text-muted-foreground">Select a card to remove from your deck</p>
          <div className="flex flex-wrap justify-center gap-3">
            {runDeck.map((card, i) => (
              <DeckCardItem key={`${card.id}-${i}`} card={card} index={i} isSelected={selectedRemoveIndex === i} onSelect={setSelectedRemoveIndex} />
            ))}
          </div>
          <div className="mt-5 flex justify-center gap-3">
            <Button variant="ghost" onClick={() => { setRemoveMode(false); setSelectedRemoveIndex(null); }}>Cancel</Button>
            <Button size="lg" disabled={selectedRemoveIndex === null || gold < SHOP_REMOVE_PRICE} onClick={handleRemoveConfirm}>
              Remove Card ({SHOP_REMOVE_PRICE} Gold)
            </Button>
          </div>
        </div>
      )}

      <Button size="lg" variant="outline" className="mt-2 min-w-44" onClick={onContinue}>Leave Shop</Button>
    </div>
  );
}
