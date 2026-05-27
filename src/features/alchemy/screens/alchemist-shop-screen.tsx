// Alchemist's Shop screen — buy potions, refresh, or mix two potions from your deck.
import { useMemo, useState } from "react";
import { FlaskConical, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isStandardPotionCard, type BattleCard } from "@/lib/game-data";
import {
  ALCHEMIST_POTION_PRICE,
  ALCHEMIST_MIX_PRICE,
  ALCHEMIST_REFRESH_PRICE,
  MIXED_POTION_CARD_ID,
  MIXED_POTION_TITLE,
  SELECTION_GRID_PAGE_SIZE,
} from "@/lib/game-constants";

import { BattleCardButton } from "../ui/card-button";
import { PurchasableCardItem, SelectableShopCard } from "../ui/shop-card-item";
import { CardSelectionGrid } from "../ui/card-selection-grid";
import { GoldDisplay, ScreenDescription, ScreenHeader, ServiceButton } from "../ui/shared-ui";
import { collectionTileWidthClass } from "../config";
import { useRunStore } from "../stores/run-store";
import { useScreenStore } from "../stores/screen-store";

export function AlchemistShopScreen({
  onBuyCard,
  onRefresh,
  onMixPotions,
  onContinue,
}: {
  onBuyCard: (card: BattleCard) => void;
  onRefresh: () => void;
  onMixPotions: (indexA: number, indexB: number) => BattleCard | null;
  onContinue: () => void;
}) {
  const gold = useRunStore((s) => s.runGold);
  const runDeck = useRunStore((s) => s.runDeck);
  const potionCards = useScreenStore((s) => s.alchemistState.potions);
  const refreshesLeft = useScreenStore((s) => s.alchemistState.refreshesLeft);
  const mixUsed = useScreenStore((s) => s.alchemistState.mixUsed);
  const potionPrice = ALCHEMIST_POTION_PRICE;
  const mixPrice = ALCHEMIST_MIX_PRICE;
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

  function startMix() {
    setMixMode(true);
    setMixStep(1);
    setSelectedA(null);
    setSelectedB(null);
    setMixPage(0);
  }
  function cancelMix() {
    setMixMode(false);
    setMixStep(0);
    setSelectedA(null);
    setSelectedB(null);
    setMixPage(0);
  }

  function selectMixCard(index: number) {
    // Potion mixing is a two-step selection machine: generated Mixed Potions are excluded,
    // re-clicking the first pick backs up to step one, and the second pick toggles freely.
    if (runDeck[index].id === MIXED_POTION_CARD_ID) return;
    if (mixStep === 1) {
      setSelectedA(index);
      setMixStep(2);
    } else if (mixStep === 2) {
      if (index === selectedA) {
        setSelectedA(null);
        setMixStep(1);
      } else if (index === selectedB) {
        setSelectedB(null);
      } else setSelectedB(index);
    }
  }

  function handleMixConfirm() {
    // Build a preview result before mutating the deck so the reveal can show the crafted
    // card after the controller removes the two source potions.
    if (selectedA === null || selectedB === null) return;
    const result = onMixPotions(selectedA, selectedB);
    if (result) setMixedCard(result);
  }

  const mixableCards = useMemo(
    () => runDeck.map((c, i) => ({ card: c, index: i })).filter(({ card }) => isStandardPotionCard(card)),
    [runDeck],
  );
  const hasEnoughPotionsToMix = mixableCards.length >= 2;
  const mixDisabled = gold < mixPrice || !hasEnoughPotionsToMix;
  const mixDisabledMessage = hasEnoughPotionsToMix ? "Not Enough Gold" : "Not Enough Potions to Mix";

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-6 text-center">
      <ScreenHeader title="Alchemist's Shop" />
      {!mixedCard ? <GoldDisplay gold={gold} /> : null}

      {mixedCard ? (
        <div className="state-swap flex flex-col items-center gap-6">
          <p className="text-lg font-semibold text-emerald-400">Added to Deck: {MIXED_POTION_TITLE}</p>
          <div className="flex flex-col items-center gap-3">
            <div onMouseEnter={() => setMixedCardHovered(true)} onMouseLeave={() => setMixedCardHovered(false)}>
              <BattleCardButton
                card={mixedCard}
                hovered={mixedCardHovered}
                onHoverStart={() => setMixedCardHovered(true)}
                onHoverEnd={() => setMixedCardHovered(false)}
                ariaLabel={MIXED_POTION_TITLE}
                shimmerActive={false}
                shimmerToken={undefined}
                className={collectionTileWidthClass}
              />
            </div>
          </div>
          <Button
            size="lg"
            onClick={() => {
              setMixedCard(null);
              cancelMix();
            }}
          >
            Continue
          </Button>
        </div>
      ) : !mixMode ? (
        <div className="state-swap flex flex-col items-center gap-6">
          <div key={potionCards.map((card) => card.id).join("-")} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {potionCards.map((card, i) => (
              <PurchasableCardItem
                key={`${card.id}-${i}`}
                card={card}
                price={potionPrice}
                gold={gold}
                purchased={purchasedIds.has(card.id)}
                onBuy={() => handleBuyCard(card)}
              />
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            <ServiceButton
              icon={FlaskConical}
              label="Mix Potions"
              cost={mixPrice}
              disabled={mixDisabled}
              disabledMessage={mixDisabledMessage}
              used={mixUsed}
              soldOutText="Mix Potions — Sold Out"
              onClick={startMix}
            />
            <ServiceButton
              icon={RefreshCw}
              label="Refresh Shop"
              cost={ALCHEMIST_REFRESH_PRICE}
              disabled={refreshesLeft <= 0 || gold < ALCHEMIST_REFRESH_PRICE}
              disabledMessage="Not Enough Gold"
              used={refreshesLeft <= 0}
              soldOutText="Refresh — Sold Out"
              onClick={onRefresh}
            />
          </div>

          <Button size="lg" className="min-w-44" onClick={onContinue}>
            Leave
          </Button>
        </div>
      ) : (
        <div className="state-swap">
          <ScreenDescription className="mb-3">Select two Potions to Combine</ScreenDescription>
          <CardSelectionGrid
            items={mixableCards}
            page={mixPage}
            onPageChange={setMixPage}
            pageSize={SELECTION_GRID_PAGE_SIZE}
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
            <Button variant="outline" onClick={cancelMix}>
              Cancel
            </Button>
            <Button size="lg" disabled={selectedA === null || selectedB === null} onClick={handleMixConfirm}>
              Combine
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
