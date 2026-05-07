// Alchemist's Shop screen — buy potions, refresh, or mix two potions from your deck.
import { useState } from "react";
import type { CSSProperties } from "react";
import { Coins, FlaskConical, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BattleCard } from "@/lib/game-data";
import { ALCHEMIST_MIX_PRICE, ALCHEMIST_POTION_PRICE, ALCHEMIST_REFRESH_PRICE, COLLECTION_PAGE_SIZE } from "@/lib/game-constants";

import { BattleCardButton } from "../ui/card-ui";
import { DisabledTooltip, GoldCost, PaginationControls } from "../ui/shared-ui";
import { collectionCardWidthClass, handCardWidthClass } from "../config";
import { createMixedPotion } from "../potion-mixer";

function PotionCardItem({ card, gold, purchased, onBuy, index }: { card: BattleCard; gold: number; purchased: boolean; onBuy: () => void; index: number }) {
  const [hovered, setHovered] = useState(false);

  if (purchased) {
    return (
      <div className="stagger-item flex flex-col items-center gap-3 rounded-[18px] border border-border/30 bg-card/30 p-4 text-center opacity-50" style={{ "--stagger-index": index } as CSSProperties}>
        <BattleCardButton card={card} hovered={false} onHoverStart={() => {}} onHoverEnd={() => {}} ariaLabel={card.title} shimmerActive={false} className={handCardWidthClass} />
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
      <DisabledTooltip show={gold < ALCHEMIST_POTION_PRICE} message="Not Enough Gold">
        <Button size="sm" variant="outline" disabled={gold < ALCHEMIST_POTION_PRICE} onClick={onBuy}>
          Buy <GoldCost amount={ALCHEMIST_POTION_PRICE} />
        </Button>
      </DisabledTooltip>
    </div>
  );
}

function MixPotionCardItem({ card, visualIndex, isSelected, onSelect }: { card: BattleCard; visualIndex: number; isSelected: boolean; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={cn("stagger-item cursor-pointer rounded-[18px] border p-2 text-center transition-all", isSelected ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border/60 bg-card/40 hover:border-border")}
      style={{ "--stagger-index": visualIndex } as CSSProperties}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onClick={onSelect}>
      <BattleCardButton card={card} hovered={hovered} onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)} ariaLabel={`Inspect ${card.title}`} shimmerActive={false} className={collectionCardWidthClass} />
      <p className="mt-1 text-xs font-semibold text-foreground">{card.title}</p>
    </div>
  );
}

function ServiceButton({ icon: Icon, label, cost, disabled, used, soldOutText, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; cost: number; disabled: boolean; used: boolean; soldOutText: string; onClick: () => void }) {
  if (used) {
    return <Button variant="outline" disabled className="text-muted-foreground/40">{soldOutText}</Button>;
  }
  const tooltip = label === "Mix Potions" ? "Not Enough Potions to Mix" : "Not Enough Gold";
  return (
    <DisabledTooltip show={disabled} message={tooltip}>
      <Button variant="outline" disabled={disabled} onClick={onClick}>
        <Icon className="h-4 w-4" />
        <span className="text-sm font-normal">{label}</span>
        <GoldCost amount={cost} />
      </Button>
    </DisabledTooltip>
  );
}

function GoldDisplay({ gold }: { gold: number }) {
  return <p className="flex items-center gap-2 text-lg font-medium text-yellow-300"><Coins className="h-5 w-5" />{gold} Gold</p>;
}

export function AlchemistHutScreen({
  gold, potionCards, runDeck, refreshesLeft, mixUsed,
  onBuyCard, onRefresh, onMixPotions, onContinue,
}: {
  gold: number; potionCards: BattleCard[]; runDeck: BattleCard[]; refreshesLeft: number; mixUsed: boolean;
  onBuyCard: (card: BattleCard) => void; onRefresh: () => void;
  onMixPotions: (indexA: number, indexB: number) => void; onContinue: () => void;
}) {
  const [mixMode, setMixMode] = useState(false);
  const [mixStep, setMixStep] = useState(0);
  const [selectedA, setSelectedA] = useState<number | null>(null);
  const [selectedB, setSelectedB] = useState<number | null>(null);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [mixedCard, setMixedCard] = useState<BattleCard | null>(null);
  const [mixPage, setMixPage] = useState(0);
  const [mixedCardHovered, setMixedCardHovered] = useState(false);

  function handleBuyCard(card: BattleCard) {
    if (purchasedIds.has(card.id)) return;
    onBuyCard(card);
    setPurchasedIds((prev) => new Set(prev).add(card.id));
  }

  function startMix() { setMixMode(true); setMixStep(1); setSelectedA(null); setSelectedB(null); setMixPage(0); }
  function cancelMix() { setMixMode(false); setMixStep(0); setSelectedA(null); setSelectedB(null); setMixPage(0); }

  function selectMixCard(index: number) {
    if (runDeck[index].id === "mixed-potion") return;
    if (mixStep === 1) {
      setSelectedA(index); setMixStep(2);
    } else if (mixStep === 2) {
      if (index === selectedA) { setSelectedA(null); setMixStep(1); }
      else if (index === selectedB) { setSelectedB(null); }
      else setSelectedB(index);
    }
  }

  function handleMixConfirm() {
    if (selectedA === null || selectedB === null) return;
    const cardA = runDeck[selectedA];
    const cardB = runDeck[selectedB];
    try {
      const result = createMixedPotion(cardA, cardB);
      onMixPotions(selectedA, selectedB);
      setMixedCard(result);
    } catch { return; }
  }

  const mixableCards = runDeck.map((c, i) => ({ card: c, index: i })).filter(({ card }) => card.id.includes("potion") && card.id !== "mixed-potion");

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-6 text-center">
      <h1 className="text-4xl text-foreground">Alchemist's Shop</h1>
      {!mixedCard ? <GoldDisplay gold={gold} /> : null}

      {mixedCard ? (
        <div className="state-swap flex flex-col items-center gap-6">
          <p className="text-lg font-semibold text-emerald-400">Added to Deck: Mixed Potion</p>
          <div className="flex flex-col items-center gap-3">
            <div onMouseEnter={() => setMixedCardHovered(true)} onMouseLeave={() => setMixedCardHovered(false)}>
              <BattleCardButton card={mixedCard} hovered={mixedCardHovered} onHoverStart={() => setMixedCardHovered(true)} onHoverEnd={() => setMixedCardHovered(false)} ariaLabel="Mixed Potion" shimmerActive={false} className={handCardWidthClass} />
            </div>
          </div>
          <Button size="lg" onClick={() => { setMixedCard(null); cancelMix(); }}>Continue</Button>
        </div>
      ) : !mixMode ? (
        <>
          <div key={potionCards.map((card) => card.id).join("-")} className="state-swap grid grid-cols-1 gap-4 sm:grid-cols-3">
            {potionCards.map((card, i) => (
              <PotionCardItem key={`${card.id}-${i}`} card={card} gold={gold} purchased={purchasedIds.has(card.id)} onBuy={() => handleBuyCard(card)} index={i} />
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            <ServiceButton
              icon={FlaskConical} label="Mix Potions" cost={ALCHEMIST_MIX_PRICE}
              disabled={gold < ALCHEMIST_MIX_PRICE || mixableCards.length < 2}
              used={mixUsed} soldOutText="Mix Potions — Sold Out"
              onClick={startMix}
            />
            <ServiceButton
              icon={RefreshCw} label="Refresh Shop" cost={ALCHEMIST_REFRESH_PRICE}
              disabled={refreshesLeft <= 0 || gold < ALCHEMIST_REFRESH_PRICE}
              used={refreshesLeft <= 0} soldOutText="Refresh — Sold Out"
              onClick={onRefresh}
            />
          </div>
        </>
      ) : (
        <div className="state-swap">
          <p className="mb-3 text-sm font-semibold text-foreground">Select two Potions to Combine</p>
          {(() => {
            const pageSize = COLLECTION_PAGE_SIZE;
            const totalPages = Math.max(1, Math.ceil(mixableCards.length / pageSize));
            const pageItems = mixableCards.slice(mixPage * pageSize, (mixPage + 1) * pageSize);

            return (
              <>
                <div className="grid grid-cols-5 grid-rows-2 items-start justify-items-center gap-x-4 gap-y-5">
                  {pageItems.map(({ card, index }, visualIndex) => {
                    const isSelected = selectedA === index || selectedB === index;
                    return (
                      <MixPotionCardItem key={`${card.id}-${index}`} card={card}
                        visualIndex={visualIndex}
                        isSelected={isSelected}
                        onSelect={() => selectMixCard(index)} />
                    );
                  })}
                  {Array.from({ length: Math.max(0, pageSize - pageItems.length) }).map((_, i) => (
                    <div key={`mix-filler-${i}`} className={collectionCardWidthClass} aria-hidden="true" />
                  ))}
                </div>
                <PaginationControls page={mixPage} totalPages={totalPages} onPageChange={setMixPage} />
              </>
            );
          })()}
          <div className="mt-5 flex justify-center gap-3">
            <Button variant="ghost" onClick={cancelMix}>Cancel</Button>
            <Button size="lg" disabled={selectedA === null || selectedB === null} onClick={handleMixConfirm}>Combine</Button>
          </div>
        </div>
      )}

      {!mixMode && !mixedCard ? <Button size="lg" className="mt-2 min-w-44" onClick={onContinue}>Continue</Button> : null}
    </div>
  );
}
