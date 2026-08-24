// Alchemist's Shop screen — buy potions, refresh, or mix two potions from your deck.
import { useMemo, useState } from "react";
import { FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isStandardPotionCard } from "@/lib/game-data/cards/card-pools";
import type { BattleCard } from "@/lib/game-data";
import { MIXED_POTION_CARD_ID, MIXED_POTION_TITLE, SELECTION_GRID_PAGE_SIZE } from "@/lib/game-constants";
import { collectionTileWidthClass, BUTTON_WIDTH_ACTION } from "@/features/alchemy/shared/config";

import { BattleCardButton } from "../../shared/ui/card-button";
import { PurchasableCardItem } from "../../shared/ui/shop-card-item";
import { SelectableCard } from "../../shared/ui/selectable-card";
import { CardSelectionGrid } from "../../shared/ui/card-selection-grid";
import { ScreenDescription, ServiceButton } from "../../shared/ui/shared-ui";
import { useCaptureEscapeCancel } from "../../shared/ui/use-capture-escape-cancel";
import { RefreshShopServiceButton, ShopBrowseOfferings, ShopBrowseShell } from "./shop-browse-shell";
import { FadeSlot } from "../../shared/ui/fade-slot";
import { shopItemSlotKey, shopOfferingsSwapKey } from "../shop/shop-slot-keys";

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
  onOpenMenu,
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
  onOpenMenu: (rect?: DOMRect) => void;
}) {
  // One phase machine for potion mixing: idle → picking (two picks) with page state.
  const [mix, setMix] = useState<{ step: 0 | 1 | 2; a: number | null; b: number | null; page: number }>({
    step: 0,
    a: null,
    b: null,
    page: 0,
  });
  const [mixedCard, setMixedCard] = useState<BattleCard | null>(null);
  const mixMode = mix.step > 0;

  function resetSelections() {
    setMix({ step: 0, a: null, b: null, page: 0 });
  }

  // Escape cancels potion selection only — not the mixed-card reveal (Continue).
  useCaptureEscapeCancel(mixMode && !mixedCard ? resetSelections : undefined);

  function startMix() {
    setMix({ step: 1, a: null, b: null, page: 0 });
  }

  function selectMixCard(index: number) {
    // Potion mixing is a two-step selection machine: generated Mixed Potions are excluded,
    // re-clicking the first pick backs up to step one, and the second pick toggles freely.
    const card = runDeck[index];
    if (!card) return;
    if (card.id === MIXED_POTION_CARD_ID) return;
    if (mix.step === 1) {
      setMix((s) => ({ ...s, step: 2, a: index }));
    } else if (mix.step === 2) {
      if (index === mix.a) {
        setMix((s) => ({ ...s, step: 1, a: null }));
      } else if (index === mix.b) {
        setMix((s) => ({ ...s, b: null }));
      } else {
        setMix((s) => ({ ...s, b: index }));
      }
    }
  }

  function handleMixConfirm() {
    // Build a preview result before mutating the deck so the reveal can show the crafted
    // card after the controller removes the two source potions.
    if (mix.a === null || mix.b === null) return;
    const result = onMixPotions(mix.a, mix.b);
    if (result) setMixedCard(result);
  }

  const mixableCards = useMemo(
    () => runDeck.map((c, i) => ({ card: c, index: i })).filter(({ card }) => isStandardPotionCard(card)),
    [runDeck],
  );
  const hasEnoughPotionsToMix = mixableCards.length >= 2;
  const mixDisabled = gold < mixPrice || !hasEnoughPotionsToMix;
  const mixDisabledMessage = hasEnoughPotionsToMix ? "Not Enough Gold" : "Not Enough Potions to Mix";
  const modeKey = mixedCard ? "result" : mixMode ? "mix" : "browse";

  return (
    <ShopBrowseShell title="Alchemist's Shop" gold={gold} showGold={!mixedCard} onOpenMenu={onOpenMenu}>
      <FadeSlot swapKey={modeKey} className="min-h-[56cqh] w-full">
        {mixedCard ? (
          <div className="flex flex-col items-center gap-6">
            <div>
              <p className="text-lg font-semibold text-balance text-emerald-400">Added to Deck: {MIXED_POTION_TITLE}</p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <BattleCardButton
                card={mixedCard}
                ariaLabel={MIXED_POTION_TITLE}
                shimmerActive={false}
                shimmerToken={undefined}
                className={collectionTileWidthClass}
              />
            </div>
            <div>
              <Button
                size="lg"
                className={BUTTON_WIDTH_ACTION}
                onClick={() => {
                  setMixedCard(null);
                  resetSelections();
                }}
              >
                Continue
              </Button>
            </div>
          </div>
        ) : !mixMode ? (
          <ShopBrowseOfferings
            swapKey={shopOfferingsSwapKey(
              potionCards.map((card, i) => shopItemSlotKey(card.id, i)),
              refreshesLeft,
            )}
            onLeave={onContinue}
            serviceClassName="gap-4"
            services={
              <>
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
                <RefreshShopServiceButton
                  gold={gold}
                  refreshesLeft={refreshesLeft}
                  refreshPrice={refreshPrice}
                  onRefresh={onRefresh}
                  label="Refresh Shop"
                />
              </>
            }
          >
            {potionCards.map((card, i) => {
              const slotKey = shopItemSlotKey(card.id, i);
              return (
                <PurchasableCardItem
                  key={slotKey}
                  card={card}
                  price={getPotionPrice(card)}
                  gold={gold}
                  purchased={purchasedSlotKeys.includes(slotKey)}
                  onBuy={() => onBuyCard(card, slotKey)}
                />
              );
            })}
          </ShopBrowseOfferings>
        ) : (
          <div>
            <ScreenDescription className="mb-3">Select two Potions to Combine</ScreenDescription>
            <CardSelectionGrid
              items={mixableCards}
              page={mix.page}
              onPageChange={(page) => setMix((s) => ({ ...s, page }))}
              pageSize={SELECTION_GRID_PAGE_SIZE}
              paginationSize="default"
              paginationReserveSpace
              renderItem={({ card, index }) => (
                <SelectableCard
                  card={card}
                  chrome="shop"
                  isSelected={mix.a === index || mix.b === index}
                  onSelect={() => selectMixCard(index)}
                />
              )}
            />
            <div className="mt-5 flex justify-center gap-3">
              <Button size="lg" variant="outline" onClick={resetSelections}>
                Cancel
              </Button>
              <Button size="lg" disabled={mix.a === null || mix.b === null} onClick={handleMixConfirm}>
                Combine
              </Button>
            </div>
          </div>
        )}
      </FadeSlot>
    </ShopBrowseShell>
  );
}
