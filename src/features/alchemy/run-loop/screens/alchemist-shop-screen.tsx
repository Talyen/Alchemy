import { useGameTranslation } from "@/components/use-game-translation";

import { useEffect, useRef, useState } from "react";
import { FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type BattleCard, isPotionCard } from "@/lib/game-data";
import { PotionComparison } from "./potion-comparison";
import { BrewPotionPanel } from "./brew-potion-panel";
import { strengthenPotion, type BrewOperation } from "@/lib/alchemist/brewing";
import { collectionTileWidthClass, getCardInspectionShineColors } from "@/features/alchemy/shared/config";

import { BattleCardButton } from "../../shared/ui/cards/card-button";
import { ServiceButton } from "../shop/ui/service-button";
import { ShopShelf, type ShopShelfProps } from "./shop-shelf";
import { ShopBrowseShell } from "./shop-browse-shell";
import { FadeSlot } from "../../shared/ui/use-fade";

export function AlchemistShopScreen({
  gold,
  runDeck,
  mixUsed,
  mixPrice,
  onMixPotions,
  onStrengthenPotion,
  afterProgressSaved = (feedback) => feedback(),
  isProgressSavePending = () => false,
  ...shelf
}: ShopShelfProps<"card"> & {
  runDeck: BattleCard[];
  mixUsed: boolean;
  mixPrice: number;
  onMixPotions: (indexA: number, indexB: number) => BattleCard | null;
  onStrengthenPotion: (index: number) => BattleCard | null;
  afterProgressSaved?: (feedback: () => void) => void;
}) {
  const i18n = useGameTranslation();
  const [brewMode, setBrewMode] = useState<"combine" | "strengthen" | null>(null);
  const [mixedCard, setMixedCard] = useState<BattleCard | null>(null);
  const [originalPotion, setOriginalPotion] = useState<BattleCard | null>(null);
  const resultSequence = useRef(0);
  useEffect(
    () => () => {
      resultSequence.current++;
    },
    [],
  );
  const mixable = runDeck.filter(isPotionCard);
  const mixDisabled = gold < mixPrice || mixable.length < 2;
  const strengthenDisabled = gold < mixPrice || !mixable.some((card) => strengthenPotion(card));
  const mixDisabledMessage = gold < mixPrice ? "Not Enough Gold" : "Two eligible Potions required";
  const modeKey = mixedCard ? "result" : (brewMode ?? "browse");
  function confirm(operation: BrewOperation): BattleCard | null {
    const original = operation.kind === "strengthen" ? runDeck[operation.index] : null;
    const result =
      operation.kind === "combine"
        ? onMixPotions(...operation.indices)
        : operation.kind === "strengthen"
          ? onStrengthenPotion(operation.index)
          : null;
    if (result) {
      const sequence = ++resultSequence.current;
      afterProgressSaved(() => {
        if (resultSequence.current === sequence) {
          setOriginalPotion(original ?? null);
          setMixedCard(result);
        }
      });
    }
    return result;
  }
  return (
    <FadeSlot swapKey={modeKey} className="h-full w-full">
      {mixedCard ? (
        <ShopBrowseShell
          title={i18n.text("ui.alchemist-shop-screen.1", "Alchemist's Shop")}
          gold={gold}
          showGold={false}
        >
          <div className="flex flex-col items-center gap-6">
            {originalPotion ? (
              <PotionComparison original={originalPotion} result={mixedCard} />
            ) : (
              <div className="flex flex-col items-center gap-3">
                <BattleCardButton
                  card={mixedCard}
                  ariaLabel={i18n.displayText(mixedCard.title)}
                  shimmerActive={false}
                  shimmerToken={undefined}
                  shineColor={getCardInspectionShineColors(mixedCard)}
                  className={collectionTileWidthClass}
                />
              </div>
            )}
            <div>
              <Button
                size="lg"
                className="min-w-56"
                onClick={() => {
                  setMixedCard(null);
                  setBrewMode(null);
                }}
              >
                {i18n.text("ui.alchemist-shop-screen.2", "Continue")}
              </Button>
            </div>
          </div>
        </ShopBrowseShell>
      ) : brewMode ? (
        <ShopBrowseShell title={i18n.text("ui.alchemist-shop-screen.3", "Alchemist's Shop")} gold={gold}>
          <BrewPotionPanel
            deck={runDeck}
            kind={brewMode}
            selectionSound="shopSelect"
            price={mixPrice}
            gold={gold}
            isProgressSavePending={isProgressSavePending}
            onConfirm={confirm}
            onBack={() => {
              resultSequence.current++;
              setBrewMode(null);
            }}
          />
        </ShopBrowseShell>
      ) : (
        <ShopShelf
          {...shelf}
          kind="card"
          title={i18n.text("ui.alchemist-shop-screen.4", "Alchemist's Shop")}
          gold={gold}
          isProgressSavePending={isProgressSavePending}
          extraServices={
            <>
              <ServiceButton
                icon={FlaskConical}
                label={i18n.text("ui.alchemist-shop-screen.5", "Mix Potion")}
                cost={mixPrice}
                disabled={mixDisabled}
                disabledMessage={mixDisabledMessage}
                used={mixUsed}
                soldOutText={i18n.text("ui.alchemist-shop-screen.attr1", "Mix Potion - Used")}
                onClick={() => setBrewMode("combine")}
              />
              <ServiceButton
                icon={FlaskConical}
                label={i18n.text("ui.alchemist-shop-screen.6", "Distill")}
                cost={mixPrice}
                disabled={strengthenDisabled}
                disabledMessage={
                  gold < mixPrice
                    ? i18n.text("shop.not-enough-gold", "Not Enough Gold")
                    : i18n.text("shop.no-distill", "No eligible Potions to distill")
                }
                used={mixUsed}
                soldOutText={i18n.text("ui.alchemist-shop-screen.attr2", "Distill - Used")}
                onClick={() => setBrewMode("strengthen")}
              />
            </>
          }
        />
      )}
    </FadeSlot>
  );
}
