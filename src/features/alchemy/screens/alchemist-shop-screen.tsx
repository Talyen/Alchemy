// Alchemist's Shop screen — buy potions, refresh, or mix two potions from your deck.
import { useState } from "react";
import { FlaskConical, RefreshCw } from "lucide-react";

import { BlurFade } from "@/components/ui/blur-fade";
import { Button } from "@/components/ui/button";
import type { BattleCard } from "@/lib/game-data";
import { ALCHEMIST_REFRESH_PRICE, MIXED_POTION_CARD_ID, MIXED_POTION_TITLE, POTION_CARD_ID_FRAGMENT, SELECTION_GRID_PAGE_SIZE } from "@/lib/game-constants";

import { BattleCardButton, PurchasableCardItem, SelectableShopCard } from "../ui/card-ui";
import { CardSelectionGrid } from "../ui/card-selection-grid";
import { GoldDisplay, ScreenDescription, ScreenHeader, ServiceButton, staggerDelay } from "../ui/shared-ui";
import { handCardWidthClass } from "../config";
import { createMixedPotion } from "../potion-mixer";

export function AlchemistShopScreen({
  gold, potionCards, runDeck, refreshesLeft, mixUsed, potionPrice, mixPrice,
  onBuyCard, onRefresh, onMixPotions, onContinue,
}: {
  gold: number; potionCards: BattleCard[]; runDeck: BattleCard[]; refreshesLeft: number; mixUsed: boolean; potionPrice: number; mixPrice: number;
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
    // Potion mixing is a two-step selection machine: generated Mixed Potions are excluded,
    // re-clicking the first pick backs up to step one, and the second pick toggles freely.
    if (runDeck[index].id === MIXED_POTION_CARD_ID) return;
    if (mixStep === 1) {
      setSelectedA(index); setMixStep(2);
    } else if (mixStep === 2) {
      if (index === selectedA) { setSelectedA(null); setMixStep(1); }
      else if (index === selectedB) { setSelectedB(null); }
      else setSelectedB(index);
    }
  }

  function handleMixConfirm() {
    // Build a preview result before mutating the deck so the reveal can show the crafted
    // card after the controller removes the two source potions.
    if (selectedA === null || selectedB === null) return;
    const cardA = runDeck[selectedA];
    const cardB = runDeck[selectedB];
    try {
      const result = createMixedPotion(cardA, cardB);
      onMixPotions(selectedA, selectedB);
      setMixedCard(result);
    } catch { console.error("Mix failed: source cards may include an existing Mixed Potion"); return; }
  }

  const mixableCards = runDeck.map((c, i) => ({ card: c, index: i })).filter(({ card }) => card.id.includes(POTION_CARD_ID_FRAGMENT) && card.id !== MIXED_POTION_CARD_ID);
  const hasEnoughPotionsToMix = mixableCards.length >= 2;
  const mixDisabled = gold < mixPrice || !hasEnoughPotionsToMix;
  const mixDisabledMessage = hasEnoughPotionsToMix ? "Not Enough Gold" : "Not Enough Potions to Mix";

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-6 text-center">
      <ScreenHeader title="Alchemist's Shop" />
      <BlurFade delay={staggerDelay(1)} direction="up" offset={6}>
        {!mixedCard ? <GoldDisplay gold={gold} /> : null}
      </BlurFade>

      {mixedCard ? (
        <div className="state-swap flex flex-col items-center gap-6">
          <p className="text-lg font-semibold text-emerald-400">Added to Deck: {MIXED_POTION_TITLE}</p>
          <BlurFade delay={staggerDelay(1)} direction="up" offset={8}>
            <div className="flex flex-col items-center gap-3">
              <div onMouseEnter={() => setMixedCardHovered(true)} onMouseLeave={() => setMixedCardHovered(false)}>
                <BattleCardButton card={mixedCard} hovered={mixedCardHovered} onHoverStart={() => setMixedCardHovered(true)} onHoverEnd={() => setMixedCardHovered(false)} ariaLabel={MIXED_POTION_TITLE} shimmerActive={false} shimmerToken={undefined} className={handCardWidthClass} />
              </div>
            </div>
          </BlurFade>
          <BlurFade delay={staggerDelay(2)} direction="up" offset={6}>
            <Button size="lg" onClick={() => { setMixedCard(null); cancelMix(); }}>Continue</Button>
          </BlurFade>
        </div>
      ) : !mixMode ? (
        <div className="state-swap flex flex-col items-center gap-6">
          <div key={potionCards.map((card) => card.id).join("-")} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {potionCards.map((card, i) => (
              <BlurFade key={`${card.id}-${i}`} delay={staggerDelay(2 + i)} direction="up" offset={8}>
                <PurchasableCardItem card={card} price={potionPrice} gold={gold} purchased={purchasedIds.has(card.id)} onBuy={() => handleBuyCard(card)} />
              </BlurFade>
            ))}
          </div>

          <BlurFade delay={staggerDelay(5)} direction="up" offset={6}>
            <div className="flex flex-wrap justify-center gap-4">
              <ServiceButton
                icon={FlaskConical} label="Mix Potions" cost={mixPrice}
                disabled={mixDisabled} disabledMessage={mixDisabledMessage}
                used={mixUsed} soldOutText="Mix Potions — Sold Out"
                onClick={startMix}
              />
              <ServiceButton
                icon={RefreshCw} label="Refresh Shop" cost={ALCHEMIST_REFRESH_PRICE}
                disabled={refreshesLeft <= 0 || gold < ALCHEMIST_REFRESH_PRICE} disabledMessage="Not Enough Gold"
                used={refreshesLeft <= 0} soldOutText="Refresh — Sold Out"
                onClick={onRefresh}
              />
            </div>
          </BlurFade>

          <BlurFade delay={staggerDelay(6)} direction="up" offset={6}>
            <Button size="lg" className="min-w-44" onClick={onContinue}>Leave</Button>
          </BlurFade>
        </div>
      ) : (
        <div className="state-swap">
          <ScreenDescription className="mb-3">Select two Potions to Combine</ScreenDescription>
          <CardSelectionGrid
            items={mixableCards}
            page={mixPage}
            onPageChange={setMixPage}
            pageSize={SELECTION_GRID_PAGE_SIZE}
            revealDelay={staggerDelay(2)}
            paginationSize="default"
            paginationReserveSpace
            renderItem={({ card, index }) => (
              <SelectableShopCard
                card={card}
                isSelected={selectedA === index || selectedB === index}
                onSelect={() => selectMixCard(index)}
              />
            )}
          />
          <div className="mt-5 flex justify-center gap-3">
            <BlurFade delay={staggerDelay(10)} direction="up" offset={6}>
              <Button variant="ghost" onClick={cancelMix}>Cancel</Button>
            </BlurFade>
            <BlurFade delay={staggerDelay(11)} direction="up" offset={6}>
              <Button size="lg" disabled={selectedA === null || selectedB === null} onClick={handleMixConfirm}>Combine</Button>
            </BlurFade>
          </div>
        </div>
      )}
    </div>
  );
}
