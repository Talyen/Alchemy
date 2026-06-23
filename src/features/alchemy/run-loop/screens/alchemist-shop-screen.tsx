// Alchemist's Shop screen — buy potions, refresh, or mix two potions from your deck.
import { useMemo, useState } from "react";
import { FlaskConical, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BUTTON_WIDTH_ACTION } from "@/features/alchemy/shared/config";
import { isStandardPotionCard, type BattleCard } from "@/lib/game-data";
import { MIXED_POTION_CARD_ID, MIXED_POTION_TITLE, SELECTION_GRID_PAGE_SIZE } from "@/lib/game-constants";

import { BattleCardButton } from "../../shared/ui/card-button";
import { PurchasableCardItem, SelectableShopCard } from "../../shared/ui/shop-card-item";
import { CardSelectionGrid } from "../../shared/ui/card-selection-grid";
import {
  GoldDisplay,
  ScreenDescription,
  ScreenHeader,
  ServiceButton,
  StaggerGroup,
  StaggerItem,
} from "../../shared/ui/shared-ui";
import { collectionTileWidthClass } from "@/features/alchemy/shared/config";
export function AlchemistShopScreen({
  gold,
  runDeck,
  potionCards,
  refreshesLeft,
  mixUsed,
  purchasedSlotKeys,
  getPotionPrice,
  mixPrice,
  refreshPrice,
  onBuyCard,
  onRefresh,
  onMixPotions,
  onContinue,
}: {
  gold: number;
  runDeck: BattleCard[];
  potionCards: BattleCard[];
  refreshesLeft: number;
  mixUsed: boolean;
  purchasedSlotKeys: string[];
  getPotionPrice: (card: BattleCard) => number;
  mixPrice: number;
  refreshPrice: number;
  onBuyCard: (card: BattleCard, slotKey: string) => boolean;
  onRefresh: () => void;
  onMixPotions: (indexA: number, indexB: number) => BattleCard | null;
  onContinue: () => void;
}) {
  const [mixMode, setMixMode] = useState(false);
  const [mixStep, setMixStep] = useState(0);
  const [selectedA, setSelectedA] = useState<number | null>(null);
  const [selectedB, setSelectedB] = useState<number | null>(null);
  const [mixedCard, setMixedCard] = useState<BattleCard | null>(null);
  const [mixPage, setMixPage] = useState(0);
  const [mixedCardHovered, setMixedCardHovered] = useState(false);

  function handleBuyCard(card: BattleCard, slotKey: string) {
    if (purchasedSlotKeys.includes(slotKey)) return;
    onBuyCard(card, slotKey);
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
    const card = runDeck[index];
    if (!card) return;
    if (card.id === MIXED_POTION_CARD_ID) return;
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
        <StaggerGroup className="flex flex-col items-center gap-6">
          <StaggerItem index={0}>
            <p className="text-lg font-semibold text-emerald-400">Added to Deck: {MIXED_POTION_TITLE}</p>
          </StaggerItem>
          <StaggerItem index={1} className="flex flex-col items-center gap-3">
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
          </StaggerItem>
          <StaggerItem index={2}>
            <Button
              size="lg"
              onClick={() => {
                setMixedCard(null);
                cancelMix();
              }}
            >
              Continue
            </Button>
          </StaggerItem>
        </StaggerGroup>
      ) : !mixMode ? (
        <StaggerGroup className="flex flex-col items-center gap-6">
          <StaggerGroup
            swapKey={potionCards.map((card) => card.id).join("-")}
            animate={false}
            className="grid grid-cols-1 gap-4 sm:grid-cols-3"
          >
            {potionCards.map((card, i) => {
              const slotKey = `${card.id}-${i}`;
              return (
                <PurchasableCardItem
                  key={slotKey}
                  card={card}
                  price={getPotionPrice(card)}
                  gold={gold}
                  purchased={purchasedSlotKeys.includes(slotKey)}
                  onBuy={() => handleBuyCard(card, slotKey)}
                  staggerIndex={i}
                />
              );
            })}
          </StaggerGroup>

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
              cost={refreshPrice}
              disabled={refreshesLeft <= 0 || gold < refreshPrice}
              disabledMessage="Not Enough Gold"
              used={refreshesLeft <= 0}
              soldOutText="Refresh — Sold Out"
              onClick={onRefresh}
            />
          </div>

          <Button size="lg" variant="primary" className={BUTTON_WIDTH_ACTION} onClick={onContinue}>
            Leave
          </Button>
        </StaggerGroup>
      ) : (
        <StaggerGroup>
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
        </StaggerGroup>
      )}
    </div>
  );
}
